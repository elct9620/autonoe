# Autonoe Specification

## Table of Contents

### Intent Layer
- [0. Intent](#0-intent-intent)

### Design Layer
- [1. System Overview](#1-system-overview-design)
- [2. Clean Architecture](#2-clean-architecture-design)
- [3. Core Interfaces](#3-core-interfaces-design)
- [4. Browser Automation](#4-browser-automation-coding-agent-design)
- [5. State Management](#5-state-management-design)
- [6. Security](#6-security-design)
- [10. Build & Distribution](#10-build--distribution-design)
- [11. CLI](#11-cli-design)
- [Appendix A: Instructions](#appendix-a-instructions-design)

### Consistency Layer
- [7. Decision Table](#7-decision-table-consistency)
- [8. Test Scenarios](docs/testing.md) `[External]`

### Implementation Standards (Optional)
- [Appendix B: Implementation Standards](#appendix-b-implementation-standards-implementation)

---

## 0. Intent `[Intent]`

### 0.1 Purpose

Autonoe is an autonomous coding agent orchestrator that enables iterative, self-correcting software development through Claude's Agent SDK.

### 0.2 Target Users

| User Type | Use Case |
|-----------|----------|
| Solo Developers | Reduce human-in-loop overhead for coding tasks |
| Development Teams | Accelerate feature development with minimal supervision |

### 0.3 Impacts

| Impact | Measure |
|--------|---------|
| Developer Productivity | Reduce time-to-feature delivery |
| Code Quality | Maintain acceptance criteria verification |
| Operational Safety | Enforce security boundaries |

### 0.4 Success Criteria

| Criterion | Verification |
|-----------|--------------|
| All deliverables pass | status.json shows all passed=true |
| Security maintained | No unauthorized file access or command execution |
| Reproducibility | Same SPEC.md produces consistent results |
| Graceful degradation | Blocked deliverables documented, non-blocked pass |

---

## 1. System Overview `[Design]`

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Autonoe                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌────────────────┐   ┌────────────────────────┐  │
│  │    apps/cli    │───▶│ packages/core  │   │ packages/agent         │  │
│  │  (Entry Point) │    │ (Orchestrator) │◀──│ (SDK Wrapper)          │  │
│  └───────┬────────┘    └───────┬────────┘   │                        │  │
│          │                     │            └───────────┬────────────┘  │
│          │ Injects             │ Uses                   │               │
│          └─────────────────────┼───────────────────────▶│               │
│                                │                        │               │
│                                │ Creates & Controls     │ Wraps         │
│                                ▼                        ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                        Coding Agent                                  ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │              @anthropic-ai/claude-agent-sdk                      │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                │                                     ││
│  │                                ▼                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │                      MCP Servers                                 │││
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐    │││
│  │  │  │  Playwright │  │  Built-in   │  │   File System         │    │││
│  │  │  │  (Browser)  │  │  (Bash)     │  │   (Read/Write)        │    │││
│  │  │  └─────────────┘  └─────────────┘  └───────────────────────┘    │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                │                                         │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Project Directory                               ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  ││
│  │  │  SPEC.md    │  │  .autonoe/  │  │   Generated App Code        │  ││
│  │  │             │  │ status.json │  │                             │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Component       | Technology                     |
| --------------- | ------------------------------ |
| Runtime         | Bun >= 1.3                     |
| Language        | TypeScript >= 5.9              |
| Agent SDK       | @anthropic-ai/claude-agent-sdk |
| CLI Framework   | CAC                            |
| Package Manager | Bun Workspaces                 |
| Distribution    | Bun Single Executable          |
| Container       | Docker                         |
| Formatter       | Prettier                       |
| Type Check      | tsc                            |
| Unit Test       | Vitest                         |

### 1.3 Coding Agent Tools

| Tool        | Source         | Purpose                  |
| ----------- | -------------- | ------------------------ |
| Browser     | Playwright MCP | E2E testing via browser  |
| File System | SDK Built-in   | Read/Write project files |
| Bash        | SDK Built-in   | Execute allowed commands |

### 1.4 Coding Conventions

See [Appendix B: Implementation Standards](#appendix-b-implementation-standards) for TypeScript coding conventions used in this project.

### 1.5 Project Structure

```
autonoe/
├── package.json
├── bun.lock
├── tsconfig.json
├── .prettierrc
├── Dockerfile
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── markdown.d.ts
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── agentClient.ts      # Interface only
│   │   │   ├── session.ts          # Single execution
│   │   │   ├── sessionRunner.ts    # Loop orchestration
│   │   │   ├── logger.ts
│   │   │   ├── deliverableStatus.ts # Deliverable domain model + repository interface
│   │   │   ├── bashSecurity.ts
│   │   │   ├── instructions.ts
│   │   │   └── instructions/
│   │   │       ├── initializer.md
│   │   │       └── coding.md
│   │   └── tests/
│   │       ├── *.test.ts
│   │       └── helpers/
│   │           ├── index.ts
│   │           ├── mockAgentClient.ts
│   │           ├── testLogger.ts
│   │           └── fixtures.ts
│   └── agent/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts
│           ├── claudeAgentClient.ts
│           ├── claudeCodePath.ts
│           ├── converters.ts
│           └── deliverableToolsAdapter.ts  # SDK MCP Server implementation
└── apps/
    └── cli/
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts
        │   ├── run.ts
        │   └── consoleLogger.ts
        └── bin/
            └── autonoe.ts

# Project .autonoe/ Directory (Generated)
.autonoe/
├── status.json
└── agent.json      # Optional, user custom settings (permissions, hooks, mcpServers)
```

---

## 2. Clean Architecture `[Design]`

### 2.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/cli                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Presentation Layer                      │  │
│  │  CLI commands, argument parsing, output formatting         │  │
│  │  Creates ClaudeAgentClient, injects into SessionRunner     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                                       ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│       packages/core             │  │  packages/agent                 │
│  ┌───────────────────────────┐  │  │  ┌───────────────────────────┐  │
│  │    Application Layer      │  │  │  │   Infrastructure Layer    │  │
│  │  SessionRunner            │  │  │  │  ClaudeAgentClient        │  │
│  └───────────────────────────┘  │  │  │  SDK Converters           │  │
│  ┌───────────────────────────┐  │  │  └───────────────────────────┘  │
│  │      Domain Layer         │  │  └─────────────────────────────────┘
│  │  Types, Interfaces        │  │                │
│  └───────────────────────────┘  │                │ imports types
└─────────────────────────────────┘                │
          ▲                                        │
          └────────────────────────────────────────┘
```

### 2.2 Dependency Rule

```
                    Presentation (apps/cli)
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    Application + Domain    ←    Infrastructure
     (packages/core)              (packages/agent)
```

- `packages/core` has NO external dependencies (pure domain + application)
- `packages/agent` depends on `@autonoe/core` for types
- `apps/cli` creates infrastructure and injects into application layer

### 2.3 Domain Model

#### Stream Events

**StreamEvent** - Discriminated union of all event types

```typescript
type StreamEvent = StreamEventText | StreamEventThinking | StreamEventToolInvocation | StreamEventToolResponse | StreamEventEnd | StreamEventError
```

**StreamEventText** - Agent's text response

| Field | Type | Description |
|-------|------|-------------|
| type | 'stream_text' | Event type discriminator |
| text | string | Text content |

**StreamEventThinking** - Agent's internal reasoning (summarized in Claude 4 models)

| Field | Type | Description |
|-------|------|-------------|
| type | 'stream_thinking' | Event type discriminator |
| thinking | string | Thinking/reasoning content |

Thinking events are:
- Automatically generated by Claude Agent SDK (no configuration required)
- Summarized in Claude 4 models, full output in Claude 3.7
- Displayed in debug mode only (via `logger.debug`)
- Truncated to 200 characters in debug output

**StreamEventToolInvocation** - Agent's tool call request

| Field | Type | Description |
|-------|------|-------------|
| type | 'stream_tool_invocation' | Event type discriminator |
| name | string | Tool name |
| input | Record\<string, unknown\> | Tool parameters |

**StreamEventToolResponse** - Tool execution result (returned to Agent)

| Field | Type | Description |
|-------|------|-------------|
| type | 'stream_tool_response' | Event type discriminator |
| toolUseId | string | Corresponding tool use ID |
| content | string | Result content |
| isError | boolean | Whether the tool execution failed |

**StreamEventEnd** - Discriminated union for session termination

| Outcome | Variant Fields | Description |
|---------|----------------|-------------|
| completed | result?: string | Normal completion |
| execution_error | messages: string[] | Execution errors |
| max_iterations | - | Hit iteration limit |
| budget_exceeded | - | API cost limit hit |
| quota_exceeded | message?: string, resetTime?: Date | Subscription quota hit |

Common fields: `type: 'stream_end'`, `outcome: SessionOutcome`, `totalCostUsd?: number`

**StreamEventError** - SDK error wrapped as event

| Field | Type | Description |
|-------|------|-------------|
| type | 'stream_error' | Event type discriminator |
| message | string | Error message |
| stack | string? | Stack trace (for debugging) |

**MessageStream Error Handling:**

The SDK may throw errors after yielding `stream_end` for certain outcomes (e.g., quota exceeded causes Claude Code to exit with code 1). The `ClaudeAgentClient` wrapper handles this by:

1. Wrap SDK errors as `StreamEventError` events (yield instead of throw)
2. Session checks if `stream_end` was already received:
   - If yes: Log error at debug level and continue (expected behavior)
   - If no: Throw the error (real failure)

This encapsulates SDK-specific behavior in the infrastructure layer, keeping the domain layer (Session) clean.

#### Value Objects

**McpServer** - External tool server configuration

| Field | Type | Description |
|-------|------|-------------|
| command | string | Server executable command |
| args | string[]? | Command arguments |

**DeliverableInput** - Single deliverable definition

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique deliverable identifier |
| description | string | Clear description of the deliverable |
| acceptanceCriteria | string[] | List of acceptance criteria |

**CreateDeliverableInput** - Input for create_deliverable tool

| Field | Type | Description |
|-------|------|-------------|
| deliverables | DeliverableInput[] | Array of deliverables to create |

**SetDeliverableStatusInput** - Input for set_deliverable_status tool

| Field | Type | Description |
|-------|------|-------------|
| deliverableId | string | Deliverable ID to update |
| status | 'pending' \| 'passed' \| 'blocked' | New status (pending=reset, passed=completed, blocked=external constraints) |

**OperationResult** - Result returned by application services

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether operation succeeded |
| message | string | Human-readable result message |
| error | string? | Error code (if failed) |

#### Entities

**Deliverable** - Verifiable work unit with acceptance criteria

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (e.g., DL-001) |
| description | string | Clear description of the deliverable |
| acceptanceCriteria | string[] | Verifiable conditions for completion |
| status | 'pending' \| 'passed' \| 'blocked' | Current status (pending=not started/reset, passed=completed, blocked=external constraints) |

| Type | acceptanceCriteria Examples |
|------|----------------------------|
| Feature | "User can login via OAuth", "Error message shown on invalid credentials" |
| Refactor | "API response time reduced by 50%", "Code coverage maintained above 80%" |
| Technical Rewrite | "New and old API behavior identical", "No breaking changes" |

**Deliverable State Machine:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Deliverable State Machine                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐                                              │
│   │  create  │                                              │
│   └────┬─────┘                                              │
│        │                                                    │
│        ▼                                                    │
│   ┌──────────┐    set_status('passed')       ┌──────────┐  │
│   │ pending  │ ─────────────────────────────▶│  passed  │  │
│   │ status=  │                               │ status=  │  │
│   │'pending' │◀─────────────────────────────│ 'passed' │  │
│   └────┬─────┘    set_status('pending')      └──────────┘  │
│        │                                           ▲        │
│        │ set_status('blocked')                     │        │
│        ▼                                           │        │
│   ┌──────────┐                                     │        │
│   │ blocked  │─────────────────────────────────────┘        │
│   │ status=  │    set_status('passed')                      │
│   │'blocked' │                                              │
│   └────┬─────┘                                              │
│        │                                                    │
│        └─────────────── set_status('pending') ──────────────┤
│                                    │                        │
│                                    ▼                        │
│                              (back to pending)              │
└─────────────────────────────────────────────────────────────┘
```

| Transition | From | To | Constraint |
|------------|------|-----|------------|
| create | - | pending | Initial state |
| set_status('passed') | pending/blocked | passed | Sets status='passed' |
| set_status('blocked') | pending | blocked | Sets status='blocked' |
| set_status('pending') | passed/blocked | pending | Sets status='pending' |

Invariant: Single `status` field eliminates invalid state combinations.

#### Aggregates

**DeliverableStatus** - Root aggregate for deliverable tracking

| Field | Type | Description |
|-------|------|-------------|
| createdAt | string | Creation date (YYYY-MM-DD) |
| updatedAt | string | Last update date, updated on tool use |
| deliverables | Deliverable[] | All tracked deliverables |

Persistence: `.autonoe/status.json`

#### Repository

**DeliverableStatusReader** - Read-only interface for checking deliverable status

```typescript
interface DeliverableStatusReader {
  exists(): Promise<boolean>
  load(): Promise<DeliverableStatus>
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| exists | `() => Promise<boolean>` | Check if status file exists |
| load | `() => Promise<DeliverableStatus>` | Load status or return empty |

Used by `SessionRunner` to determine loop termination and instruction selection.

**DeliverableRepository** - Full repository interface extending reader

```typescript
interface DeliverableRepository extends DeliverableStatusReader {
  save(status: DeliverableStatus): Promise<void>
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| save | `(status: DeliverableStatus) => Promise<void>` | Persist to storage |

Implementation lives in infrastructure layer (`packages/agent`).

#### Enums

**SessionOutcome** - Literal type union

| Value | Description |
|-------|-------------|
| 'completed' | Session finished normally |
| 'max_iterations' | Hit turn/iteration limit |
| 'execution_error' | Error during execution |
| 'budget_exceeded' | API cost limit hit |
| 'quota_exceeded' | Subscription quota hit |

**PermissionLevel** - Security permission level

| Value | Description |
|-------|-------------|
| default | Standard permissions |
| acceptEdits | Auto-accept file edits |
| bypassPermissions | Skip all permission checks |

#### Type Aliases

**MessageStream** - Async stream of agent events with interrupt capability

```typescript
interface MessageStream extends AsyncGenerator<StreamEvent, void> {
  interrupt(): Promise<void>
}
```

| Field | Type | Description |
|-------|------|-------------|
| (generator) | AsyncGenerator\<StreamEvent, void\> | Yields stream events |
| interrupt | () => Promise\<void\> | Interrupt the ongoing query |

**Type Definitions:** See `packages/core/src/types.ts`

---

## 3. Core Interfaces `[Design]`

### 3.1 AgentClient

```typescript
// packages/core/src/agentClient.ts
interface AgentClient {
  query(instruction: string): MessageStream
  dispose(): Promise<void>
}

interface AgentClientFactory {
  create(): AgentClient
}

// Constructor options for AgentClient implementations
interface AgentClientOptions {
  cwd: string
  mcpServers?: Record<string, McpServer>
  permissionLevel?: PermissionLevel
  allowedTools?: string[]
  sandbox?: SandboxConfig
  preToolUseHooks?: PreToolUseHook[]
  model?: string
  maxThinkingTokens?: number
}
```

#### 3.1.1 Session Lifecycle

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

### 3.2 MockAgentClient

```typescript
// packages/core/tests/helpers/mockAgentClient.ts
class MockAgentClient implements AgentClient {
  private responses: AgentMessage[] = []

  setResponses(responses: AgentMessage[]): void
  query(message: string): MessageStream
}
```

### 3.3 Session

```typescript
// packages/core/src/session.ts
// Session is a stateless service - configuration belongs to AgentClient
interface Session {
  run(client: AgentClient, instruction: string, logger?: Logger): Promise<SessionResult>
}

// Discriminated union: success or failure
type SessionResult =
  | {
      success: true
      costUsd: number
      duration: number
      outcome: SessionOutcome
      quotaResetTime?: Date
    }
  | {
      success: false
      error: string
      duration: number
    }
```

**Error Responses:**

| Condition | Result | Error Field |
|-----------|--------|-------------|
| Normal completion | success=true, outcome='completed' | - |
| SDK execution error | success=true, outcome='execution_error' | messages[] in StreamEventEnd |
| Max iterations hit | success=true, outcome='max_iterations' | - |
| Budget exceeded | success=true, outcome='budget_exceeded' | - |
| Quota exceeded | success=true, outcome='quota_exceeded' | message in StreamEventEnd |
| Unhandled exception | success=false | error string |

### 3.4 BashSecurity

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

### 3.5 Deliverable Management Tools (SDK Custom Tools)

#### 3.5.1 Architecture

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

#### 3.5.2 Tool Specifications

**create_deliverable** - Create one or more deliverables in status.json

| Parameter | Type | Description |
|-----------|------|-------------|
| deliverables | array | Array of deliverable objects |
| deliverables[].id | string | Unique identifier |
| deliverables[].description | string | Clear description |
| deliverables[].acceptanceCriteria | string[] | Verifiable conditions |

**set_deliverable_status** - Update deliverable status

| Parameter | Type | Description |
|-----------|------|-------------|
| deliverableId | string | Target deliverable ID |
| status | enum | 'pending' \| 'passed' \| 'blocked' |

**Status Semantics:**

| Status | passed | blocked | Use Case |
|--------|--------|---------|----------|
| pending | false | false | Reset state, bugs found in passed deliverable |
| passed | true | false | All acceptance criteria verified |
| blocked | false | true | External constraints prevent completion |

**External Constraints (blocked):**
- Missing API keys or credentials
- Unavailable external services
- Missing hardware requirements
- Network restrictions

**NOT blocked (use pending instead):**
- Implementation dependencies
- Code refactoring needed
- Technical debt

#### 3.5.5 Tool Usage

| Tool                   | Phase          | Operation                                                |
| ---------------------- | -------------- | -------------------------------------------------------- |
| create_deliverable     | Initialization | Create deliverables with acceptance criteria             |
| set_deliverable_status | Coding         | Set status: pending (reset), passed, or blocked          |

#### 3.5.6 Status Change Notification

**DeliverableStatusNotification** - Notification payload

| Field | Type | Description |
|-------|------|-------------|
| deliverableId | string | Deliverable ID |
| deliverableDescription | string | Deliverable description |
| previousStatus | DeliverableStatusValue \| undefined | Previous status (undefined if new) |
| newStatus | DeliverableStatusValue | New status |

**DeliverableStatusCallback** - Callback type

```typescript
type DeliverableStatusCallback = (notification: DeliverableStatusNotification) => void
```

**Output Format:**

| Status | Icon | Example |
|--------|------|---------|
| passed | [PASS] | `[PASS] User Auth (DL-001)` |
| blocked | [BLOCKED] | `[BLOCKED] Payment (DL-002)` |
| pending | [PENDING] | `[PENDING] Dashboard (DL-003)` |

### 3.6 PreToolUse Hook

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

| Field | Type | Description |
|-------|------|-------------|
| toolName | string | Name of the tool being called |
| toolInput | Record\<string, unknown\> | Tool parameters |

**HookResult** - Result returned from hook callback

| Field | Type | Description |
|-------|------|-------------|
| continue | boolean | Whether to continue processing (false = stop hook chain) |
| decision | 'approve' \| 'block' | Final decision (optional) |
| reason | string | Reason for decision (optional, displayed to agent) |

**PreToolUseHook** - Hook definition

| Field | Type | Description |
|-------|------|-------------|
| name | string | Hook identifier for debugging |
| matcher | string | Tool name pattern to match (optional, undefined = match all) |
| callback | (input) => Promise\<HookResult\> | Async callback function |

**Built-in Hooks:**

| Hook | Purpose |
|------|---------|
| BashSecurity | Validate bash commands against allowlist |
| AutonoeProtection | Block direct writes to .autonoe/ directory |

### 3.7 Dependency Injection

| Component              | Injected Via              | Purpose                         |
| ---------------------- | ------------------------- | ------------------------------- |
| AgentClient            | SessionRunner.run()       | Enable testing with mocks       |
| BashSecurity           | PreToolUse hook           | Validate bash commands          |
| create_deliverable     | SDK createSdkMcpServer    | Create deliverables             |
| set_deliverable_status | SDK createSdkMcpServer    | Set deliverable status          |
| Logger                 | SessionRunner.run()       | Enable output capture           |

```
SessionRunner(options) ──▶ run(client, logger) ──▶ Session.run() ──▶ client.query()
              │                    │                    │
         Configuration        Dependency          Per-session
```

### 3.8 Logger

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

| Layer        | Logger Usage                           |
| ------------ | -------------------------------------- |
| Presentation | ConsoleLogger with colored output      |
| Application  | Use injected Logger for messages       |
| Domain       | No direct logging (pure functions)     |
| Tests        | TestLogger to capture and verify       |

#### 3.8.1 Message Format

**Debug Messages** (--debug flag only):

| Event              | Format                                                    |
| ------------------ | --------------------------------------------------------- |
| Send instruction   | `[Send] {instruction (truncated to 200)}`                 |
| Receive message    | `[Recv] {type}: {content (truncated to 200)}`             |
| Thinking           | `[Recv] stream_thinking: [thinking] {thinking (truncated to 200)}` |
| Error with stack   | `{message}\n{stack}`                                      |

**Session Messages** (info level):

| Event         | Format                                     |
| ------------- | ------------------------------------------ |
| Session start | `Session {N} started`                      |
| Session end   | `Session {N}: cost=${cost}, duration={duration}` |

**Overall Messages** (info level, logged on SessionRunner completion):

| Event           | Format                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Overall summary | `Overall: {iterations} session(s), {passed}/{total} deliverables passed, cost=${totalCost}, duration={totalDuration}` |

**Examples:**
- Session: `Session 1: cost=$0.0234, duration=45s`
- Session: `Session 2: cost=$0.0156, duration=1m 30s`
- Overall: `Overall: 2 session(s), 5/5 deliverables passed, cost=$0.0390, duration=2m 15s`
- Overall (with blocked): `Overall: 3 session(s), 3/5 deliverables passed (2 blocked), cost=$0.0580, duration=5m 20s`

#### 3.8.2 Duration Format

All duration displays use human-readable format with zero-value parts omitted:

| Component | Condition                          | Format    |
| --------- | ---------------------------------- | --------- |
| Hours     | > 0                                | `{h}h `   |
| Minutes   | > 0                                | `{m}m `   |
| Seconds   | > 0 or (hours=0 and minutes=0)     | `{s}s`    |

**Examples:**
- 3661000ms → `1h 1m 1s`
- 3600000ms → `1h`
- 90000ms → `1m 30s`
- 60000ms → `1m`
- 5000ms → `5s`
- 0ms → `0s`

**Utility Function:**
- `formatDuration(ms: number): string` in `packages/core/src/duration.ts`

### 3.9 Session Loop

#### 3.9.1 Architecture

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

#### 3.9.2 Loop Types

| Loop             | Location         | Controller       | Purpose                          |
| ---------------- | ---------------- | ---------------- | -------------------------------- |
| Session Loop     | SessionRunner    | --max-iterations | Run multiple agent sessions      |
| Agent Turn Loop  | Claude Agent SDK | SDK internal     | Process messages within session  |

#### 3.9.3 Resource Scope

| Scope        | Resource            |
| ------------ | ------------------- |
| Per Session  | ClaudeAgentClient   |
| Per Session  | SDK child process   |
| Per Session  | instruction         |
| Shared       | AgentClientFactory  |
| Shared       | Client configuration|

#### 3.9.4 SessionRunner Interface

```typescript
// packages/core/src/sessionRunner.ts
interface SessionRunner {
  run(
    clientFactory: AgentClientFactory,
    logger: Logger,
    statusReader?: DeliverableStatusReader,
    instructionResolver?: InstructionResolver,
    signal?: AbortSignal
  ): Promise<SessionRunnerResult>
}

interface SessionRunnerOptions {
  projectDir: string
  maxIterations?: number        // undefined = unlimited
  delayBetweenSessions?: number // default: 3000ms
  model?: string
  waitForQuota?: boolean        // wait for quota reset instead of exiting
  maxThinkingTokens?: number    // extended thinking mode budget (min: 1024)
  maxRetries?: number           // default: 3, max consecutive errors before exit
}

interface SessionRunnerResult {
  iterations: number
  deliverablesPassedCount: number
  deliverablesTotalCount: number
  blockedCount: number
  totalDuration: number      // displayed using formatDuration()
  totalCostUsd: number       // sum of all session costs
  interrupted?: boolean
  quotaExceeded?: boolean
  error?: string             // error message when maxRetries exceeded
}

// Exit reason type for unified exit point
type ExitReason =
  | 'all_passed'
  | 'all_blocked'
  | 'max_iterations'
  | 'quota_exceeded'
  | 'interrupted'
  | 'max_retries_exceeded'
```

### 3.10 Termination Conditions

| Priority | Condition                    | Check                                         | Result              |
| -------- | ---------------------------- | --------------------------------------------- | ------------------- |
| 1        | Quota exceeded (no wait)     | outcome === 'quota_exceeded' && !waitForQuota | success=false, quotaExceeded=true |
| 2        | All achievable passed        | All non-blocked deliverables have passed=true | success=true        |
| 3        | All blocked                  | All deliverables have blocked=true            | success=false       |
| 4        | Max iterations reached       | iteration >= maxIterations                    | success=false       |
| 5        | User interrupt               | SIGINT received                               | success=false, interrupted=true |
| 6        | Max retries exceeded         | consecutiveErrors > maxRetries                | success=false, error=message |

**Blocked Deliverable Rules:**
- A deliverable can only be blocked when `passed=false` (mutual exclusion)
- Blocked means external constraints prevent completion (missing API keys, unavailable services, hardware, network)
- When all non-blocked deliverables pass, the session succeeds even if some are blocked
- When all deliverables are blocked, the session fails
- Reasons for blocking should be documented in `.autonoe-note.md`

**Quota Handling:**

When Claude Code Subscription quota is exceeded:
- SDK returns `subtype: 'success'` with limit message in `result` field (e.g., "You've hit your limit · resets 6pm (UTC)")
- Claude Code process exits with code 1
- Detection: Text pattern matching on session result for "You've hit your limit"
- Reset time parsing: Extract time from "resets Xpm (UTC)" or "resets Xam (UTC)" pattern

Behavior options:
- **Default (waitForQuota=false):** Exit immediately with `quotaExceeded: true`
- **Wait mode (waitForQuota=true):** Auto-calculate wait duration from reset time and pause until quota resets, then retry

Quota detection utilities in `quotaManager.ts`:
- `isQuotaExceededMessage(text)` - Check if message indicates quota limit
- `parseQuotaResetTime(text)` - Extract reset time from message
- `calculateWaitDuration(resetTime)` - Calculate milliseconds to wait

**Session Error Retry:**

When a session throws an error (e.g., context window exhaustion, SDK errors):
- SessionRunner tracks `consecutiveErrors` counter
- On error: increment counter, log warning, start new session
- On success: reset counter to 0
- When `consecutiveErrors > maxRetries`: exit with `error` field in result

Retry behavior:
- **Default (maxRetries=3):** Allow up to 3 consecutive errors before exit
- Each retry starts a fresh session with `clientFactory.create()`
- Quota exceeded is NOT counted as a retry error (handled separately)
- Overall info is logged even on max retries exit

**Session Error Classification:**

| Outcome | Source | Description | Retry Strategy |
|---------|--------|-------------|----------------|
| 'quota_exceeded' | SDK | API subscription quota exhausted | Controlled by `waitForQuota` option |
| 'execution_error' | SDK/Session | Internal SDK errors or runtime errors | Count toward `consecutiveErrors` |

---

## 4. Browser Automation (Coding Agent) `[Design]`

### 4.1 Playwright MCP Tools

Uses Microsoft Playwright MCP server (`@playwright/mcp@latest`) with session isolation:

| Flag | Purpose |
|------|---------|
| `--headless` | Run browser without GUI for CI/server environments |
| `--isolated` | Ensure browser instance isolation per session |

- Server: https://github.com/microsoft/playwright-mcp
- Tool prefix: `mcp__playwright__*`
- Allowed tools defined in `PLAYWRIGHT_MCP_TOOLS` constant (`packages/core/src/configuration.ts`)

#### 4.1.1 Browser Installation

| Platform     | Sandbox | Browser Source       | Status              |
|--------------|---------|----------------------|---------------------|
| Linux x64    | Enabled | MCP browser_install  | ✓                   |
| Linux ARM64  | Enabled | MCP browser_install  | ✗ (not supported)   |
| Linux ARM64  | Disabled| npx playwright       | ✓                   |
| Docker       | Disabled| npx playwright       | ✓ (recommended)     |

**SDK Sandbox Limitations:**
- MCP `browser_install` fails on Linux ARM64: "not supported on Linux Arm64"
- SDK cannot detect pre-installed browsers (via `npx playwright install`)

**Docker Configuration:**
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/playwright-browsers`
- `AUTONOE_NO_SANDBOX=1` (sandbox disabled for compatibility)

**Recommended SPEC.md Prompt** (for Docker/ARM64):
```markdown
## Prerequisites
Install Chromium before browser testing:
npx playwright install --with-deps chromium
```

#### 4.1.2 Browser Lifecycle

```
Session Start ─────► MCP Server Start ─────► Browser Launch
                                                   │
                                                   ▼
                                            [Browser Operations]
                                                   │
                                                   ▼
Session End ◄────── client.dispose() ◄────── Browser Close
```

**Session Isolation**: The `--isolated` flag ensures each session creates an independent browser context, preventing state leakage between iterations. This enables reliable multi-session workflows where browser state is fresh for each coding cycle.

### 4.2 Verification Flow

```
navigate ──▶ snapshot ──▶ interact ──▶ wait_for ──▶ verify_*
```

---

## 5. State Management `[Design]`

### 5.1 Directory Structure

```
project/
├── .autonoe/
│   └── status.json
└── .autonoe-note.md
```

### 5.2 Status Tracking (.autonoe/status.json)

```json
{
  "createdAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD",
  "deliverables": [
    {
      "id": "DL-001",
      "description": "User Authentication",
      "acceptanceCriteria": [
        "User can login with email and password",
        "Invalid credentials show error message",
        "Session persists across page refresh"
      ],
      "passed": false,
      "blocked": false
    }
  ]
}
```

**Note:** For backward compatibility, the JSON file uses `passed` (boolean) and `blocked` (boolean) fields. The domain model internally uses a single `status` field that maps to these values:
- `status='pending'` → `passed=false, blocked=false`
- `status='passed'` → `passed=true, blocked=false`
- `status='blocked'` → `passed=false, blocked=true`

### 5.3 State Persistence

| State                | Writer                       | Reader | Description                        |
| -------------------- | ---------------------------- | ------ | ---------------------------------- |
| Project Files        | Coding Agent (Direct)        | Both   | Application source code            |
| .autonoe/status.json | Deliverable Tools            | Both   | Deliverable tracking               |
| .autonoe-note.md    | Coding Agent (Direct)        | Both   | Session handoff notes (agent-maintained) |
| Git History          | Coding Agent (Direct)        | Both   | Version control history            |

### 5.4 Configuration

**Configuration Sources:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Sources                         │
├─────────────────────────────────────────────────────────────────┤
│  Hardcoded (packages/core)                                       │
│  ├── sandbox: { enabled: true }                                  │
│  └── mcpServers: { playwright: @playwright/mcp --headless --isolated }│
│                                                                  │
│  Security Baseline (packages/core, always enforced)              │
│  ├── permissions.allow: [Read(./**), Write(./**), ...]           │
│  ├── allowedTools: [Read, Write, Edit, ..., mcp__playwright__*]  │
│  └── hooks: [BashSecurity, .autonoe Protection]                  │
│                                                                  │
│  User Config (.autonoe/agent.json)                               │
│  ├── profile: "node" | ["node", "python"]  # Language profiles   │
│  ├── allowCommands: [...]      # Hook layer extensions           │
│  ├── allowPkillTargets: [...]  # Hook layer extensions           │
│  ├── permissions.allow: [...]  # SDK layer (Merged with baseline)│
│  ├── allowedTools: [...]       # Merged with baseline            │
│  └── mcpServers: { ... }       # User priority (see below)       │
└─────────────────────────────────────────────────────────────────┘
```

| Setting          | Source            | Layer | Customizable   |
| ---------------- | ----------------- | ----- | -------------- |
| sandbox          | Hardcoded         | SDK   | --no-sandbox   |
| profile          | ALL by default    | Hook  | Restrict       |
| allowCommands    | (none)            | Hook  | User-defined   |
| allowPkillTargets| (none)            | Hook  | User-defined   |
| permissions      | baseline + user   | SDK   | Merge          |
| allowedTools     | baseline + user   | SDK   | Merge          |
| hooks            | baseline + user   | Hook  | Merge          |
| mcpServers       | Hardcoded + user  | SDK   | User priority  |

**MCP Servers User Priority:**

| agent.json mcpServers | Result                           |
| --------------------- | -------------------------------- |
| (undefined)           | Built-in Playwright loaded       |
| `{}`                  | No servers (disabled all)        |
| `{ "playwright": {} }`| User config overrides built-in   |
| `{ "custom": {} }`    | Built-in + custom (merged)       |

**Permission Rule Format:**

| Pattern | Description |
|---------|-------------|
| `Read(./**)` | File read access |
| `Write(./**)` | File write access |
| `Edit(./**)` | File edit access |
| `Bash(*)` | Any bash command |
| `Bash(npm run *)` | Specific command pattern |
| `WebFetch(*)` | Network access |
| `Glob(./**)` | Glob search |
| `Grep(./**)` | Content search |

**agent.json Structure:**

```json
{
  "profile": ["node", "python"],
  "allowCommands": ["docker", "custom-cli"],
  "allowPkillTargets": ["custom-server"],
  "permissions": {
    "allow": [
      "WebFetch(https://api.example.com/*)"
    ]
  },
  "allowedTools": ["Task", "WebSearch"],
  "mcpServers": {
    "custom-tool": {
      "command": "npx",
      "args": ["custom-mcp-server"]
    }
  }
}
```

| Field             | Type                        | Layer | Description                             |
| ----------------- | --------------------------- | ----- | --------------------------------------- |
| profile           | `string \| string[]`        | Hook  | Restrict to specific language profiles  |
| allowCommands     | `string[]`                  | Hook  | Additional bash commands to allow       |
| allowPkillTargets | `string[]`                  | Hook  | Additional pkill target processes       |
| permissions.allow | `string[]`                  | SDK   | SDK permission rules (e.g., WebFetch)   |
| allowedTools      | `string[]`                  | SDK   | Additional SDK tools to enable          |
| mcpServers        | `Record<string, McpServer>` | SDK   | Additional MCP servers                  |

**SDK Settings Bridge:**

```
.autonoe/agent.json → loadConfig() → SECURITY_BASELINE + user config → SDK settings
```

### 5.5 SDK Sandbox Configuration

**SandboxSettings:**

| Setting                  | Default | CLI Override | Env Variable          |
| ------------------------ | ------- | ------------ | --------------------- |
| enabled                  | true    | --no-sandbox | AUTONOE_NO_SANDBOX=1  |
| autoAllowBashIfSandboxed | true    | -            | -                     |

**Resolution Order:**
1. `--no-sandbox` CLI flag (explicit disable)
2. `AUTONOE_NO_SANDBOX=1` environment variable
3. Default: enabled

See Section 6 for security layer architecture.

---

## 6. Security `[Design]`

### 6.1 Autonoe Security Controls

| Control              | Implementation              | Enforcement     |
| -------------------- | --------------------------- | --------------- |
| OS-Level Sandbox     | SandboxSettings.enabled     | SDK (hardcoded) |
| Bash Auto-Allow      | autoAllowBashIfSandboxed    | SDK (hardcoded) |
| Filesystem Scope     | permissions: ["./**"]       | SDK             |
| Bash Allowlist       | BashSecurity hook           | PreToolUse      |
| .autonoe/ Protection | PreToolUse hook             | PreToolUse      |

**Security Layers:**

```
┌─────────────────────────────────────────────────────┐
│              Autonoe Security Layers                │
├─────────────────────────────────────────────────────┤
│  Layer 1: SDK Sandbox (enabled: true)               │
│  ├── OS-level process isolation                     │
│  └── Filesystem/network containment                 │
├─────────────────────────────────────────────────────┤
│  Layer 2: Filesystem Scope (SDK permissions)        │
│  └── Read/Write limited to project directory        │
├─────────────────────────────────────────────────────┤
│  Layer 3: PreToolUse Hooks                          │
│  ├── BashSecurity: Command allowlist                │
│  └── .autonoe/ Protection: Block direct writes      │
└─────────────────────────────────────────────────────┘
```

### 6.2 Coding Agent Restrictions

| Resource      | Direct Access | Tool Access            | Enforcement                       |
| ------------- | ------------- | ---------------------- | --------------------------------- |
| Project Files | R/W           | -                      | SDK permissions                   |
| .autonoe/     | Read-only     | Write (status tools)   | PreToolUse hook blocks direct W/E |
| Bash Commands | -             | Limited allowlist      | BashSecurity hook                 |

### 6.3 Bash Command Security

#### 6.3.1 Language Profile Architecture

Bash command allowlist is organized by language profiles. By default, ALL profiles are enabled.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEFAULT (All Profiles)                        │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐           │
│  │  BASE   │  NODE   │ PYTHON  │  RUBY   │   GO    │           │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘           │
│                           │                                      │
│                           ▼                                      │
│              USER EXTENSIONS (agent.json)                        │
│              allowCommands: [...]                                │
└─────────────────────────────────────────────────────────────────┘
```

Users may restrict to specific profiles via `agent.json`:

| agent.json profile     | Active Profiles                       |
| ---------------------- | ------------------------------------- |
| (not set)              | ALL (base + node + python + ruby + go)|
| `"node"`               | base + node                           |
| `"python"`             | base + python                         |
| `["node", "python"]`   | base + node + python                  |

For detailed command allowlists, argument validation rules, and runtime security options, see [Security Details](docs/security.md).

---

## 7. Decision Table `[Consistency]`

### 7.1 Session Loop Behavior

| .autonoe/status.json | --max-iterations | Action                                  |
| -------------------- | ---------------- | --------------------------------------- |
| NOT EXISTS           | any              | Use initializerInstruction, continue    |
| EXISTS (none passed) | any              | Run all deliverables                    |
| EXISTS (partial)     | any              | Run deliverables with passed=false      |
| EXISTS (all passed)  | any              | Exit loop, success                      |
| any                  | reached limit    | Exit loop, partial                      |
| any                  | undefined        | Continue until all pass                 |

### 7.2 Coding Agent Tool Availability

Tools available to the Coding Agent (configured by Autonoe):

| Tool Category        | Available |
| -------------------- | --------- |
| File Read            | YES       |
| File Write           | YES       |
| Bash (safe)          | YES       |
| Git                  | YES       |
| Playwright           | YES       |
| autonoe-deliverable  | YES       |

### 7.3 Instruction Selection

| Condition                   | Instruction                                      |
| --------------------------- | ------------------------------------------------ |
| No .autonoe/status.json     | .autonoe/initializer.md → initializerInstruction |
| .autonoe/status.json exists | .autonoe/coding.md → codingInstruction           |

Resolution order: project override (`.autonoe/{name}.md`) → default (`packages/core`).

### 7.4 Configuration Merge

| User Config (agent.json)    | Autonoe Behavior                            |
| --------------------------- | ------------------------------------------- |
| Custom permissions          | Merge with security baseline                |
| Custom hooks                | Merge with security baseline                |
| Custom mcpServers           | User priority (see Section 5.4)             |
| Custom allowCommands        | Merge with profile commands                 |
| Disable sandbox             | Allowed with warning (stderr)               |
| Remove .autonoe/ protection | Re-apply security baseline                  |

### 7.5 Profile Selection

| agent.json profile     | Active Profiles                        | Use Case                |
| ---------------------- | -------------------------------------- | ----------------------- |
| (not set)              | ALL (base + node + python + ruby + go) | Default, all languages  |
| `"node"`               | base + node                            | Node.js only            |
| `"python"`             | base + python                          | Python only             |
| `"ruby"`               | base + ruby                            | Ruby only               |
| `"go"`                 | base + go                              | Go only                 |
| `["node", "python"]`   | base + node + python                   | Specific combination    |

---

## 8. Test Scenarios `[Consistency]`

Test scenarios are maintained in a separate document for easier reference and maintenance.

See [Test Scenarios](docs/testing.md) for:
- Unit test scenarios (SessionRunner, Bash Security, Deliverable Tools, Configuration, Language Profiles, Logger, Claude Agent Client, Autonoe Protection, Duration Format)
- Integration test scenarios (End-to-End, SDK Sandbox, Browser)
- CI reporting configuration

---

## 10. Build & Distribution `[Design]`

**Package Overview:**

| Package | Description |
|---------|-------------|
| root | Manages npm dependencies; child packages use `*` to inherit versions |
| @autonoe/core | Domain types and application logic (NO external dependencies) |
| @autonoe/agent | Wraps SDK, implements `AgentClient` interface from core |
| @autonoe/cli | Creates `ClaudeAgentClient`, injects into `SessionRunner` |

Package configurations are defined in their respective `package.json` files.

### 10.1 Docker Image Configuration

**Monorepo Image Strategy:**

Each publishable package maps to a separate image path under the organization namespace:

| Package | Image Path | Description |
|---------|------------|-------------|
| apps/cli | `ghcr.io/[org]/autonoe/cli` | Coding Agent CLI |

**Registry:**

| Setting | Value |
|---------|-------|
| Registry | GitHub Container Registry |
| Path Pattern | `ghcr.io/[org]/autonoe/<package>` |
| Default Tag | `:latest` = `:base` |

**Build Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                     Dockerfile                          │
├─────────────────────────────────────────────────────────┤
│  builder ──▶ Compile autonoe binary                     │
│      │                                                  │
│      ├──▶ base (debian:bookworm-slim)                   │
│      ├──▶ node (node:XX-bookworm-slim)                  │
│      ├──▶ python (python:X.XX-slim-bookworm)            │
│      ├──▶ golang (golang:X.XX-bookworm)                 │
│      └──▶ ruby (ruby:X.X-slim-bookworm)                 │
└─────────────────────────────────────────────────────────┘
```

**Targets and Tags:**

| Target | Base Image | Tag | Tools | Use Case |
|--------|------------|-----|-------|----------|
| base | debian:bookworm-slim | `:latest`, `:base` | git, curl, ca-certificates | Minimal runtime |
| node | node:XX-bookworm-slim | `:node` | git, curl, npm, Playwright deps | Frontend development |
| python | python:X.XX-slim-bookworm | `:python` | git, curl, Node.js, npm, Playwright deps, pip, venv, uv | Backend / Data science |
| golang | golang:X.XX-bookworm | `:golang` | git, curl, Node.js, npm, Playwright deps | System programming |
| ruby | ruby:X.X-slim-bookworm | `:ruby` | git, curl, Node.js, npm, Playwright deps, Bundler | Web development |

Each target must include base tools (git, curl, ca-certificates) for Claude Code to function properly.

**Tag Naming Convention:**

| Pattern | Example | Description |
|---------|---------|-------------|
| `:base` | `:base` | Minimal runtime (no language tools) |
| `:<lang>` | `:node`, `:python` | Language runtime with Node.js + Playwright |
| `:X.Y.Z-<variant>` | `:1.0.0-node` | Versioned tag |

**Build Args:**

| Arg | Default | Description |
|-----|---------|-------------|
| `NODE_VERSION` | XX | Node.js LTS (check latest) |
| `PYTHON_VERSION` | X.XX | Python stable (check latest) |
| `GOLANG_VERSION` | X.XX | Go stable (check latest) |
| `RUBY_VERSION` | X.X | Ruby stable (check latest) |

### 10.2 Version Support Policy

| Language | Policy |
|----------|--------|
| Node.js | Current LTS |
| Python | Current stable |
| Golang | Current stable |
| Ruby | Current stable |

**Version Updates**:
- Default versions follow official LTS/stable releases
- Users can specify versions via Build Args for custom builds

### 10.3 Release Management

| Tool                     | Purpose                            |
| ------------------------ | ---------------------------------- |
| Release Please           | Version management, CHANGELOG      |
| Bun cross-compile        | Multi-platform binary distribution |
| docker/build-push-action | Multi-platform Docker images       |

**Workflow Structure:**

| Workflow             | Trigger      | Purpose                                              |
| -------------------- | ------------ | ---------------------------------------------------- |
| `ci.yml`             | Push to main | Docker latest + Bun snapshot binaries                |
| `release-please.yml` | Push to main | Release Please + versioned Docker + binary release   |

### 10.3.1 Reusable Workflow Architecture

**Unified Approach:**

| Component | Type | Location | Purpose |
|-----------|------|----------|---------|
| Docker builds | Reusable Workflow | `.github/workflows/build-docker.yml` | Job-level reuse with matrix strategy |
| Binary builds | Reusable Workflow | `.github/workflows/build-binaries.yml` | Job-level reuse with matrix strategy |

**build-docker.yml Inputs:**

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `tag-strategy` | string | Yes | `latest` or `semver` |
| `version-tag` | string | No | Version tag for semver (e.g., `v1.0.0`) |

**build-binaries.yml Inputs:**

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `tag-strategy` | string | Yes | `snapshot` or `release` |
| `version-tag` | string | No | Version tag for release (e.g., `v1.0.0`) |

**Artifact Strategy:**

| Strategy | Artifacts | Retention | Checksums |
|----------|-----------|-----------|-----------|
| snapshot | Per-platform (binary-{target}) | 7 days | None |
| release | Per-platform (binary-{target}) | 90 days | Per-platform .sha256 files |

**Release Assets Example:**

```
autonoe-linux-x64.tar.gz
autonoe-linux-x64.tar.gz.sha256
autonoe-darwin-arm64.tar.gz
autonoe-darwin-arm64.tar.gz.sha256
...
```

---

## 11. CLI `[Design]`

### 11.1 Usage

```
autonoe run [options]

Options:
  --project-dir, -p       Project directory (default: cwd)
  --max-iterations, -n    Maximum coding sessions
  --max-retries           Maximum retries on session error (default: 3)
  --model, -m             Claude model to use
  --debug, -d             Show debug output
  --no-sandbox            Disable SDK sandbox
  --wait-for-quota        Wait for quota reset instead of exiting
  --allow-destructive, -D Enable rm/mv with path validation
  --thinking [budget]     Enable extended thinking mode (default: 8192)
```

### 11.2 Behavior

- Runs in specified project directory (or cwd if not specified)
- All relative paths (.autonoe/, SPEC.md) resolved from project directory
- Reads `SPEC.md` for project specification
- Agent SDK auto-detects API credentials
- Shows help message when no command is provided

**Project Directory Resolution:**

| --project-dir     | Directory Exists | Result             |
| ----------------- | ---------------- | ------------------ |
| (not provided)    | -                | Use `process.cwd()`|
| absolute path     | YES              | Use as-is          |
| relative path     | YES              | Resolve to absolute|
| any path          | NO               | Exit with error    |

### 11.3 Implementation

```typescript
// apps/cli/bin/autonoe.ts
import cac from 'cac'

const cli = cac('autonoe')

cli
  .command('run', 'Run the coding agent')
  .option('-p, --project-dir <path>', 'Project directory')
  .option('-n, --max-iterations <count>', 'Maximum coding sessions')
  .option('--max-retries <count>', 'Maximum retries on session error (default: 3)')
  .option('-m, --model <model>', 'Claude model to use')
  .option('-d, --debug', 'Show debug output')
  .option('--no-sandbox', 'Disable SDK sandbox')
  .option('--wait-for-quota', 'Wait for quota reset instead of exiting')
  .option('-D, --allow-destructive', 'Enable rm/mv with path validation')
  .option('--thinking [budget]', 'Enable extended thinking mode (default: 8192)')
  .action((options) => {
    // Run session with options
  })

cli.help()
cli.version('0.1.0')
cli.parse()
```

---

## Appendix A: Instructions `[Design]`

### A.1 Instruction Selection

| Instruction   | Condition                   |
| ------------- | --------------------------- |
| initializer   | No .autonoe/status.json     |
| coding        | .autonoe/status.json exists |

### A.2 Instruction Override

| Override File           | Fallback               | Purpose                    |
| ----------------------- | ---------------------- | -------------------------- |
| .autonoe/initializer.md | Built-in instruction   | Custom initialization flow |
| .autonoe/coding.md      | Built-in instruction   | Custom implementation flow |

### A.3 InstructionResolver Interface

**InstructionName** - Available instruction types: `'initializer'` | `'coding'`

| Method | Signature | Description |
|--------|-----------|-------------|
| resolve | `(name: InstructionName) => Promise<string>` | Resolve instruction by name |

---

## Appendix B: Implementation Standards `[Implementation]`

### B.1 Private Field Naming

- Use underscore prefix (`_fieldName`) when a public getter with the same logical name exists
- No underscore when the field is accessed directly or only used internally

### B.2 Factory Methods

- Use `create*()` prefix for public factory methods that create domain objects
- Use semantic names like `static pending()`, `static enabled()` for specific state factories

### B.3 Optional Values

- Use `undefined` instead of `null` for absent values
- Use `?: Type` for optional interface properties
- Use `Type | undefined` in explicit union types

### B.4 Value Objects

- Use private constructor with static factory methods
- Make objects immutable (readonly fields, return new instances for mutations)

### B.5 Result Pattern

- Use discriminated unions for operation results
- Use `success: boolean` or `type: string` as discriminator
