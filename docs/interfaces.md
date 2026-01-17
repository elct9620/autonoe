# Core Interfaces

Detailed interface definitions for Autonoe. For overview, see [SPEC.md Section 3](../SPEC.md#3-core-interfaces-design).

---

## AgentClient

**AgentClient** - Core interface for agent communication

| Method  | Signature                                | Description                               |
| ------- | ---------------------------------------- | ----------------------------------------- |
| query   | `(instruction: string) => MessageStream` | Send instruction and receive event stream |
| dispose | `() => Promise<void>`                    | Release resources (MCP servers, browser)  |

**AgentClientFactory** - Factory for creating AgentClient instances

| Method | Signature                                           | Description                     |
| ------ | --------------------------------------------------- | ------------------------------- |
| create | `(instructionName: InstructionName) => AgentClient` | Create new AgentClient instance |

**AgentClientOptions** - Constructor options for implementations (Core layer)

| Field             | Type                        | Description               |
| ----------------- | --------------------------- | ------------------------- |
| cwd               | string                      | Working directory         |
| mcpServers        | Record\<string, McpServer\> | MCP server configurations |
| allowedTools      | string[]                    | Enabled SDK tools         |
| sandbox           | SandboxConfig               | Sandbox configuration     |
| preToolUseHooks   | PreToolUseHook[]            | Tool validation hooks     |
| model             | string                      | Claude model identifier   |
| maxThinkingTokens | number                      | Extended thinking budget  |

**ClaudeAgentClientOptions** - Extended options for ClaudeAgentClient (Agent layer)

Extends `AgentClientOptions` with SDK-specific fields:

| Field         | Type                             | Description            |
| ------------- | -------------------------------- | ---------------------- |
| sdkMcpServers | McpSdkServerConfigWithInstance[] | In-process MCP servers |

SDK permission mode is fixed to `'acceptEdits'` for autonomous operation.

### Session Lifecycle

Each session follows a strict lifecycle to ensure proper resource management:

```
Session.run() called
    │
    ├── client.query(instruction)
    │       ├── Start MCP servers
    │       ├── Launch browser (if Playwright)
    │       └── Return MessageStream
    │
    ├── Process MessageStream until completion
    │
    ├── client.dispose()
    │       ├── Stop MCP server processes
    │       ├── Close browser instances
    │       └── Release system resources
    │
    └── Return SessionResult
```

**Design Principle**: Each session must be independent and isolated. The `dispose()` method ensures that resources from one session do not leak into subsequent sessions.

**Requirement**: Sessions must have a minimum delay (`delayBetweenSessions`, default: 3000ms) between executions to ensure SDK internal cleanup completes.

---

## Session

**Session** - Stateless service for running agent queries

| Method | Signature                                                  | Description           |
| ------ | ---------------------------------------------------------- | --------------------- |
| run    | `(client, instruction, logger?) => Promise<SessionResult>` | Execute agent session |

**SessionResult** - Discriminated union (success or failure)

| Variant | Fields                                                    | Description         |
| ------- | --------------------------------------------------------- | ------------------- |
| Success | success=true, costUsd, duration, outcome, quotaResetTime? | Normal completion   |
| Failure | success=false, error, duration                            | Unhandled exception |

**Error Responses:**

| Condition           | Result                                  | Error Field                  |
| ------------------- | --------------------------------------- | ---------------------------- |
| Normal completion   | success=true, outcome='completed'       | -                            |
| SDK execution error | success=true, outcome='execution_error' | messages[] in StreamEventEnd |
| Max iterations hit  | success=true, outcome='max_iterations'  | -                            |
| Budget exceeded     | success=true, outcome='budget_exceeded' | -                            |
| Quota exceeded      | success=true, outcome='quota_exceeded'  | message in StreamEventEnd    |
| Unhandled exception | success=false                           | error string                 |

---

## SessionRunner

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      packages/core                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   SessionRunner                            │  │
│  │  client = AgentClient (reused)                             │  │
│  │                        │                                   │  │
│  │   ┌────────────────────▼────────────────────┐              │  │
│  │   │           Session Loop                   │              │  │
│  │   │  while (not terminated):                 │              │  │
│  │   │    session = new Session(options)        │              │  │
│  │   │    result = session.run(client, prompt)  │              │  │
│  │   │    if (allAchievableDeliverablesPassed) break│             │  │
│  │   │    if (maxIterations reached) break      │              │  │
│  │   │    delay(delayBetweenSessions)           │              │  │
│  │   └──────────────────────────────────────────┘              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Session                               │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ logger.info("Session N started")                     │   │  │
│  │  │ messages = client.query(instruction)                 │   │  │
│  │  │ for message in messages: process(message)            │   │  │
│  │  │ logger.info("Session N: cost=$X, duration=Ys")       │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Loop Types

| Loop            | Location         | Controller       | Purpose                         |
| --------------- | ---------------- | ---------------- | ------------------------------- |
| Session Loop    | SessionRunner    | --max-iterations | Run multiple agent sessions     |
| Agent Turn Loop | Claude Agent SDK | SDK internal     | Process messages within session |

### Resource Scope

| Scope       | Resource             |
| ----------- | -------------------- |
| Per Session | ClaudeAgentClient    |
| Per Session | SDK child process    |
| Per Session | instruction          |
| Shared      | AgentClientFactory   |
| Shared      | Client configuration |

### SessionRunner Interface

```typescript
// packages/core/src/sessionRunner.ts
interface SessionRunner {
  run(
    clientFactory: AgentClientFactory,
    logger: Logger,
    statusReader?: DeliverableStatusReader,
    instructionSelector?: InstructionSelector,
    signal?: AbortSignal,
  ): Promise<SessionRunnerResult>
}

interface SessionRunnerOptions {
  projectDir: string
  maxIterations?: number // undefined = unlimited
  delayBetweenSessions?: number // default: 3000ms
  model?: string
  waitForQuota?: boolean // wait for quota reset instead of exiting
  maxThinkingTokens?: number // extended thinking mode budget (min: 1024)
  maxRetries?: number // default: 3, max consecutive errors before exit
}

// SessionRunnerResult - Discriminated union by exitReason
type SessionRunnerResult = {
  iterations: number
  deliverablesPassedCount: number
  deliverablesTotalCount: number
  blockedCount: number
  verifiedCount: number // sync mode verification count
  verifiedTotalCount: number // sync mode total to verify
  totalDuration: number // displayed using formatDuration()
  totalCostUsd: number // sum of all session costs
} & (
  | { exitReason: 'all_passed' }
  | { exitReason: 'all_blocked' }
  | { exitReason: 'all_verified' }
  | { exitReason: 'max_iterations' }
  | { exitReason: 'quota_exceeded' }
  | { exitReason: 'interrupted' }
  | { exitReason: 'max_retries_exceeded'; error: string }
)

// Exit reason type for unified exit point
type ExitReason =
  | 'all_passed'
  | 'all_blocked'
  | 'all_verified'
  | 'max_iterations'
  | 'quota_exceeded'
  | 'interrupted'
  | 'max_retries_exceeded'
```

---

## BashSecurity

```typescript
// packages/core/src/bashSecurity.ts
interface BashSecurity {
  isCommandAllowed(command: string): ValidationResult
}

interface ValidationResult {
  allowed: boolean
  reason?: string
}
```

---

## PreToolUse Hook

PreToolUse hooks allow intercepting tool calls before execution for validation or authorization.

```typescript
// packages/core/src/agentClient.ts
interface PreToolUseInput {
  toolName: string
  toolInput: Record<string, unknown>
}

interface HookResult {
  continue: boolean
  decision?: 'approve' | 'block'
  reason?: string
}

interface PreToolUseHook {
  name: string
  matcher?: string
  callback: (input: PreToolUseInput) => Promise<HookResult>
}
```

**PreToolUseInput** - Input provided to hook callback

| Field     | Type                      | Description                   |
| --------- | ------------------------- | ----------------------------- |
| toolName  | string                    | Name of the tool being called |
| toolInput | Record\<string, unknown\> | Tool parameters               |

**HookResult** - Result returned from hook callback

| Field    | Type                 | Description                                              |
| -------- | -------------------- | -------------------------------------------------------- |
| continue | boolean              | Whether to continue processing (false = stop hook chain) |
| decision | 'approve' \| 'block' | Final decision (optional)                                |
| reason   | string               | Reason for decision (optional, displayed to agent)       |

**PreToolUseHook** - Hook definition

| Field    | Type                             | Description                                                  |
| -------- | -------------------------------- | ------------------------------------------------------------ |
| name     | string                           | Hook identifier for debugging                                |
| matcher  | string                           | Tool name pattern to match (optional, undefined = match all) |
| callback | (input) => Promise\<HookResult\> | Async callback function                                      |

**Built-in Hooks:**

| Hook              | Purpose                                    |
| ----------------- | ------------------------------------------ |
| BashSecurity      | Validate bash commands against allowlist   |
| AutonoeProtection | Block direct writes to .autonoe/ directory |

---

## Logger

```typescript
// packages/core/src/logger.ts
type LogLevel = 'info' | 'debug' | 'warning' | 'error'

interface Logger {
  info(message: string): void
  debug(message: string): void
  warn(message: string): void
  error(message: string, error?: Error): void
}

const silentLogger: Logger
```

| Level   | Visibility        | Purpose                        |
| ------- | ----------------- | ------------------------------ |
| info    | Always            | Session status, configuration  |
| debug   | --debug flag only | Internal operations, tracing   |
| warning | Always            | Non-fatal issues, deprecations |
| error   | Always            | Failures, critical errors      |

| Layer        | Logger Usage                       |
| ------------ | ---------------------------------- |
| Presentation | ConsoleLogger with colored output  |
| Application  | Use injected Logger for messages   |
| Domain       | No direct logging (pure functions) |
| Tests        | TestLogger to capture and verify   |

### Message Categories

| Category | Level | Content                                                               |
| -------- | ----- | --------------------------------------------------------------------- |
| Debug    | debug | Instruction sent, events received, thinking (truncated)               |
| Session  | info  | Session start/end with cost and duration                              |
| Overall  | info  | Summary: iterations, deliverables passed/blocked, total cost/duration |

### Duration Format

All duration displays use human-readable format with zero-value parts omitted:

| Component | Condition                      | Format  |
| --------- | ------------------------------ | ------- |
| Hours     | > 0                            | `{h}h ` |
| Minutes   | > 0                            | `{m}m ` |
| Seconds   | > 0 or (hours=0 and minutes=0) | `{s}s`  |

**Examples:**

- 3661000ms → `1h 1m 1s`
- 3600000ms → `1h`
- 90000ms → `1m 30s`
- 60000ms → `1m`
- 5000ms → `5s`
- 0ms → `0s`

**Utility Function:**

- `formatDuration(ms: number): string` in `packages/core/src/duration.ts`

---

## Presenter

Presenter is a CLI-layer interface that coordinates all console output. It ensures log messages and activity updates don't conflict.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/cli (Presentation Layer)                                   │
├─────────────────────────────────────────────────────────────────┤
│  ConsolePresenter                                                │
│  ├── log(level, message)     → Permanent output                  │
│  ├── activity(event)         → Transient output (single line)    │
│  └── clearActivity()         → Clear activity line               │
│                                                                  │
│  Internal State:                                                 │
│  ├── hasActivityLine: boolean                                    │
│  ├── currentActivity: ActivityState                              │
│  └── intervalId: Timer                                           │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  stdout (coordinated output)                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Interface Definition

```typescript
// apps/cli/src/presenter.ts
interface Presenter {
  log(level: LogLevel, message: string): void
  activity(event: StreamEvent): void
  clearActivity(): void
  start(): void
  stop(): void
}

type LogLevel = 'info' | 'debug' | 'warning' | 'error'
```

### Interface Methods

| Method        | Signature                                    | Description                    |
| ------------- | -------------------------------------------- | ------------------------------ |
| log           | `(level: LogLevel, message: string) => void` | Output permanent log message   |
| activity      | `(event: StreamEvent) => void`               | Update transient activity line |
| clearActivity | `() => void`                                 | Clear activity line            |
| start         | `() => void`                                 | Start tick timer               |
| stop          | `() => void`                                 | Stop tick timer                |

### Output Coordination

The Presenter ensures log messages are never overwritten by activity updates:

```typescript
log(level, message):
  if (hasActivityLine) clearLine()      // \r\x1b[K
  console.log(formatMessage(level, message))
  if (hasActivityLine) redrawActivityLine()

activity(event):
  updateActivityState(event)
  renderActivityLine()                  // \r\x1b[K + content (no newline)
  hasActivityLine = true

clearActivity():
  if (hasActivityLine):
    clearLine()                         // \r\x1b[K
    hasActivityLine = false
```

### StreamEvent to Display

| StreamEvent Type       | Display Content         |
| ---------------------- | ----------------------- |
| stream_thinking        | "Thinking..."           |
| stream_tool_invocation | "Running {toolName}..." |
| stream_tool_response   | (Updates tool count)    |
| stream_text            | "Responding..."         |
| stream_end             | clearActivity()         |
| stream_error           | (No change)             |

### Display Format

**Activity Line:**

```text
⚡ [elapsed] [activity] [tool count]
```

**Examples:**

```text
⚡ 0:05 Thinking...
⚡ 0:12 Running bash... (1 tool)
⚡ 0:45 Running Read... (3 tools)
⚡ 1:23 Responding... (7 tools)
```

**Waiting Display:**

```text
⏳ Waiting... 2h 44m remaining (resets at 6:00 PM UTC)
```

### Visual Example

```text
Initial:
(empty)

After activity(thinking):
⚡ 0:05 Thinking..._              <- cursor here, no newline

After log("info", "Session 2 started"):
1. Clear activity line (\r\x1b[K)
2. Print "Session 2 started\n"
3. Redraw activity line

Result:
Session 2 started                 <- Log (permanent)
⚡ 0:05 Thinking..._              <- Activity (transient)

After activity(tool_start):
Session 2 started                 <- Log unchanged
⚡ 0:08 Running bash..._          <- Activity updated (overwrites previous)
```

### Update Behavior

| Parameter        | Value                              |
| ---------------- | ---------------------------------- |
| Update interval  | 1 second (default)                 |
| Activity display | Single-line overwrite (`\r\x1b[K`) |
| Log display      | Multi-line accumulation            |

### Core Layer Integration

SessionRunner provides a `StreamEventCallback` to receive events from Session:

```typescript
// packages/core/src/sessionRunner.ts
type StreamEventCallback = (event: StreamEvent) => void

interface SessionRunnerOptions {
  // ... existing options ...
  onStreamEvent?: StreamEventCallback
}
```

The CLI layer connects this to the Presenter:

```typescript
// apps/cli - wiring
const presenter = new ConsolePresenter()

const onStreamEvent = (event: StreamEvent) => {
  presenter.activity(event)
  if (event.type === 'stream_end') {
    presenter.clearActivity()
  }
}

sessionRunner.run(clientFactory, { onStreamEvent })
```

### Comparison with Debug Mode

| Aspect            | Debug Mode                       | Normal Mode        |
| ----------------- | -------------------------------- | ------------------ |
| Information level | Full event details               | Summary only       |
| Output style      | All via log()                    | log() + activity() |
| Event content     | Shows payload data               | Activity type only |
| Tool details      | Full input/output                | Tool name only     |
| Thinking          | Content (truncated to 200 chars) | Just "Thinking..." |

---

## Autonoe Tool

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ packages/core (Domain + Application)                            │
├─────────────────────────────────────────────────────────────────┤
│ DeliverableRepository          │ Interface                      │
│ createDeliverable()            │ Application service            │
│ setDeliverableStatus()         │ Application service            │
│ Deliverable, DeliverableStatus │ Domain types                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ packages/agent (Infrastructure)                                  │
├─────────────────────────────────────────────────────────────────┤
│ FileDeliverableRepository      │ Implements DeliverableRepository│
│ createDeliverableMcpServer()   │ SDK MCP Server factory          │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Specifications

**create** - Create one or more deliverables in status.json

| Parameter                         | Type     | Description                  |
| --------------------------------- | -------- | ---------------------------- |
| deliverables                      | array    | Array of deliverable objects |
| deliverables[].id                 | string   | Unique identifier            |
| deliverables[].description        | string   | Clear description            |
| deliverables[].acceptanceCriteria | string[] | Verifiable conditions        |

**set_status** - Update deliverable status

| Parameter     | Type   | Description                        |
| ------------- | ------ | ---------------------------------- |
| deliverableId | string | Target deliverable ID              |
| status        | enum   | 'pending' \| 'passed' \| 'blocked' |

**Status Semantics:**

| Status  | passed | blocked | Use Case                                      |
| ------- | ------ | ------- | --------------------------------------------- |
| pending | false  | false   | Reset state, bugs found in passed deliverable |
| passed  | true   | false   | All acceptance criteria verified              |
| blocked | false  | true    | External constraints prevent completion       |

**External Constraints (blocked):**

- Missing API keys or credentials
- Unavailable external services
- Missing hardware requirements
- Network restrictions

**NOT blocked (use pending instead):**

- Implementation dependencies
- Code refactoring needed
- Technical debt

**deprecate** - Mark deliverable as deprecated (`sync` command only)

| Parameter     | Type   | Description           |
| ------------- | ------ | --------------------- |
| deliverableId | string | Target deliverable ID |

Returns: `{ success: boolean }`

**verify** - Mark deliverable as verified (`sync` command only)

| Parameter     | Type   | Description           |
| ------------- | ------ | --------------------- |
| deliverableId | string | Target deliverable ID |

Returns: `{ success: boolean }`

**list** - List deliverables with optional filtering (coding, verify)

| Parameter       | Type   | Default   | Description                                |
| --------------- | ------ | --------- | ------------------------------------------ |
| filter          | object | undefined | Filter criteria                            |
| filter.status   | enum   | undefined | 'pending' \| 'passed' \| 'blocked'         |
| filter.verified | bool   | undefined | true/false (only available in verify mode) |
| limit           | number | 5         | Maximum number of items to return          |

Returns: `{ deliverables: Deliverable[] }`

**Filter Examples:**

- `{"filter": {"status": "pending"}}` - List pending deliverables
- `{"filter": {"verified": false}}` - List unverified (verify mode only)
- `{"filter": {"status": "pending", "verified": false}}` - Combined filter
- `{}` or `{"limit": 10}` - List all (with optional limit)

### Tool Usage

| Tool       | Phase               | Operation                                       |
| ---------- | ------------------- | ----------------------------------------------- |
| create     | Initialization/Sync | Create deliverables with acceptance criteria    |
| set_status | Coding/Verify       | Set status: pending (reset), passed, or blocked |
| deprecate  | Sync                | Mark deliverable as deprecated                  |
| verify     | Verify              | Mark deliverable as verified (checked)          |
| list       | Coding/Sync/Verify  | List deliverables with optional filtering       |

### Status Change Notification

**DeliverableStatusNotification** - Notification payload

| Field                  | Type                                | Description                        |
| ---------------------- | ----------------------------------- | ---------------------------------- |
| deliverableId          | string                              | Deliverable ID                     |
| deliverableDescription | string                              | Deliverable description            |
| previousStatus         | DeliverableStatusValue \| undefined | Previous status (undefined if new) |
| newStatus              | DeliverableStatusValue              | New status                         |

**DeliverableStatusCallback** - Callback type

```typescript
type DeliverableStatusCallback = (
  notification: DeliverableStatusNotification,
) => void
```

**Output Format:**

| Status  | Icon      | Example                        |
| ------- | --------- | ------------------------------ |
| passed  | [PASS]    | `[PASS] User Auth (DL-001)`    |
| blocked | [BLOCKED] | `[BLOCKED] Payment (DL-002)`   |
| pending | [PENDING] | `[PENDING] Dashboard (DL-003)` |
