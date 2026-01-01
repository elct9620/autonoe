# Autonoe Specification

## 1. System Overview

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

### 1.4 Project Structure

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

## 2. Clean Architecture

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
type StreamEvent = AgentText | ToolInvocation | ToolResponse | SessionEnd
```

**AgentText** - Agent's text response

| Field | Type | Description |
|-------|------|-------------|
| type | 'agent_text' | Event type discriminator |
| text | string | Text content |

**ToolInvocation** - Agent's tool call request

| Field | Type | Description |
|-------|------|-------------|
| type | 'tool_invocation' | Event type discriminator |
| name | string | Tool name |
| input | Record\<string, unknown\> | Tool parameters |

**ToolResponse** - Tool execution result (returned to Agent)

| Field | Type | Description |
|-------|------|-------------|
| type | 'tool_response' | Event type discriminator |
| toolUseId | string | Corresponding tool use ID |
| content | string | Result content |
| isError | boolean | Whether the tool execution failed |

**SessionEnd** - Session termination state

| Field | Type | Description |
|-------|------|-------------|
| type | 'session_end' | Event type discriminator |
| subtype | ResultSubtype | Execution outcome |
| result | string? | Output text (on success) |
| errors | string[]? | Error messages (on failure) |
| totalCostUsd | number? | API cost in USD |

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
| name | string | Deliverable name |
| acceptanceCriteria | string[] | List of acceptance criteria |

**CreateDeliverableInput** - Input for create_deliverable tool

| Field | Type | Description |
|-------|------|-------------|
| deliverables | DeliverableInput[] | Array of deliverables to create |

**SetDeliverableStatusInput** - Input for set_deliverable_status tool

| Field | Type | Description |
|-------|------|-------------|
| deliverableId | string | Deliverable ID to update |
| passed | boolean | New verification status |

**BlockDeliverableInput** - Input for block_deliverable tool

| Field | Type | Description |
|-------|------|-------------|
| deliverableId | string | Deliverable ID to block |

**ToolResult** - Result returned by tool handlers

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
| name | string | Deliverable name |
| acceptanceCriteria | string[] | Verifiable conditions for completion |
| passed | boolean | Verification status |
| blocked | boolean | When true, deliverable is blocked due to environment limitations (mutually exclusive with passed=true) |

| Type | acceptanceCriteria Examples |
|------|----------------------------|
| Feature | "User can login via OAuth", "Error message shown on invalid credentials" |
| Refactor | "API response time reduced by 50%", "Code coverage maintained above 80%" |
| Technical Rewrite | "New and old API behavior identical", "No breaking changes" |

#### Aggregates

**DeliverableStatus** - Root aggregate for deliverable tracking

| Field | Type | Description |
|-------|------|-------------|
| deliverables | Deliverable[] | All tracked deliverables |

Persistence: `.autonoe/status.json`

#### Repository

**DeliverableRepository** - Interface (Core), Implementation (Infrastructure)

| Method | Signature | Description |
|--------|-----------|-------------|
| load | `() => Promise<DeliverableStatus>` | Load or return empty |
| save | `(status: DeliverableStatus) => Promise<void>` | Persist to storage |

#### Enums

**ResultSubtype** - Execution outcome

| Value | Description |
|-------|-------------|
| Success | Execution completed |
| ErrorMaxTurns | Max iterations reached |
| ErrorDuringExecution | Runtime error |
| ErrorMaxBudgetUsd | Budget limit exceeded |

**PermissionLevel** - Security permission level

| Value | Description |
|-------|-------------|
| default | Standard permissions |
| acceptEdits | Auto-accept file edits |
| bypassPermissions | Skip all permission checks |

#### Type Aliases

| Alias | Definition | Description |
|-------|------------|-------------|
| MessageStream | AsyncIterable\<StreamEvent\> | Async stream of agent events |

**Type Definitions:** See `packages/core/src/types.ts`

---

## 3. Core Interfaces

### 3.1 AgentClient

```typescript
// packages/core/src/agentClient.ts
interface AgentClient {
  query(instruction: string): MessageStream
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
}
```

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
interface Session {
  run(client: AgentClient, instruction: string, logger?: Logger): Promise<SessionResult>
}

interface SessionOptions {
  projectDir: string
  model?: string
}

interface SessionResult {
  success: boolean
  costUsd: number
  duration: number
  deliverablesPassedCount: number
  deliverablesTotalCount: number
}
```

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

#### 3.5.2 Tool Registration

```typescript
// packages/agent/src/deliverableToolsAdapter.ts
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const deliverableServer = createSdkMcpServer({
  name: 'autonoe-deliverable',
  version: '1.0.0',
  tools: [createDeliverableTool, setDeliverableStatusTool]
})
```

#### 3.5.3 createDeliverable Tool

```typescript
const createDeliverableTool = tool(
  'create_deliverable',
  'Create one or more deliverables in status.json',
  {
    deliverables: z.array(z.object({
      id: z.string(),
      name: z.string(),
      acceptanceCriteria: z.array(z.string())
    }))
  },
  async ({ deliverables }) => { /* ... */ }
)
```

#### 3.5.4 setDeliverableStatus Tool

```typescript
const setDeliverableStatusTool = tool(
  'set_deliverable_status',
  'Set deliverable verification status',
  {
    deliverableId: z.string(),
    passed: z.boolean()
  },
  async ({ deliverableId, passed }) => { /* ... */ }
)
```

#### 3.5.5 blockDeliverable Tool

```typescript
const blockDeliverableTool = tool(
  'block_deliverable',
  'Mark a deliverable as blocked due to current environment limitations. Only works when passed=false.',
  {
    deliverableId: z.string()
  },
  async ({ deliverableId }) => { /* ... */ }
)
```

**Mutual Exclusion Rule:** Cannot block a deliverable that has already passed.

#### 3.5.6 Tool Usage

| Tool                   | Phase          | Operation                                            |
| ---------------------- | -------------- | ---------------------------------------------------- |
| create_deliverable     | Initialization | Create deliverables with acceptance criteria         |
| set_deliverable_status | Coding         | Set deliverable verification status                  |
| block_deliverable      | Coding         | Mark deliverable as blocked due to environment limits |

### 3.6 Dependency Injection

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

### 3.7 Logger

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

#### 3.7.1 Debug Message Format

| Event              | Format                                        |
| ------------------ | --------------------------------------------- |
| Send instruction   | `[Send] {instruction (truncated to 200)}`     |
| Receive message    | `[Recv] {type}: {content (truncated to 200)}` |
| Error with stack   | `{message}\n{stack}` (debug only)             |

### 3.8 Session Loop

#### 3.8.1 Architecture

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
│  │   │    if (allDeliverablesPassed) break       │              │  │
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

#### 3.8.2 Loop Types

| Loop             | Location         | Controller       | Purpose                          |
| ---------------- | ---------------- | ---------------- | -------------------------------- |
| Session Loop     | SessionRunner    | --max-iterations | Run multiple agent sessions      |
| Agent Turn Loop  | Claude Agent SDK | SDK internal     | Process messages within session  |

#### 3.8.3 Client Lifecycle

```
SessionRunner
    │
    ├─ Iteration 1
    │   ├─ client = factory.create()
    │   ├─ session.run(client, instruction)
    │   └─ client disposed
    │
    ├─ delay(3000ms)
    │
    └─ Iteration 2
        ├─ client = factory.create()
        ├─ session.run(client, instruction)
        └─ client disposed
```

| Scope        | Resource            |
| ------------ | ------------------- |
| Per Session  | ClaudeAgentClient   |
| Per Session  | SDK child process   |
| Per Session  | instruction         |
| Shared       | AgentClientFactory  |
| Shared       | Client configuration|

#### 3.8.4 SessionRunner Interface

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
}

interface SessionRunnerResult {
  success: boolean
  iterations: number
  deliverablesPassedCount: number
  deliverablesTotalCount: number
  blockedCount: number
  totalDuration: number
  interrupted?: boolean
}
```

### 3.9 Termination Conditions

| Priority | Condition                    | Check                                         | Result              |
| -------- | ---------------------------- | --------------------------------------------- | ------------------- |
| 1        | All achievable passed        | All non-blocked deliverables have passed=true | success=true        |
| 2        | All blocked                  | All deliverables have blocked=true            | success=false       |
| 3        | Max iterations reached       | iteration >= maxIterations                    | success=false       |
| 4        | User interrupt               | SIGINT received                               | success=false, interrupted=true |

**Blocked Deliverable Rules:**
- A deliverable can only be blocked when `passed=false` (mutual exclusion)
- When all non-blocked deliverables pass, the session succeeds even if some are blocked
- When all deliverables are blocked, the session fails
- Reasons for blocking should be documented in `.autonoe-note.txt`

---

## 4. Browser Automation (Coding Agent)

### 4.1 Playwright MCP Tools

| Tool                                            | Description            |
| ----------------------------------------------- | ---------------------- |
| mcp**playwright**browser_navigate               | Navigate to URL        |
| mcp**playwright**browser_snapshot               | Get accessibility tree |
| mcp**playwright**browser_click                  | Click element by ref   |
| mcp**playwright**browser_fill_form              | Fill form fields       |
| mcp**playwright**browser_select_option          | Select dropdown option |
| mcp**playwright**browser_hover                  | Hover over element     |
| mcp**playwright**browser_type                   | Type text              |
| mcp**playwright**browser_press_key              | Press keyboard key     |
| mcp**playwright**browser_wait_for               | Wait for condition     |
| mcp**playwright**browser_verify_element_visible | Assert element visible |
| mcp**playwright**browser_verify_text_visible    | Assert text visible    |
| mcp**playwright**browser_handle_dialog          | Handle dialog          |
| mcp**playwright**browser_console_messages       | Get console logs       |
| mcp**playwright**browser_evaluate               | Execute JavaScript     |
| mcp**playwright**browser_close                  | Close browser          |

### 4.2 Verification Flow

```
navigate ──▶ snapshot ──▶ interact ──▶ wait_for ──▶ verify_*
```

---

## 5. State Management

### 5.1 Directory Structure

```
project/
├── features/
│   ├── authentication.feature
│   ├── dashboard.feature
│   └── settings.feature
├── .autonoe/
│   └── status.json
└── .autonoe-note.txt
```

### 5.2 Status Tracking (.autonoe/status.json)

```json
{
  "deliverables": [
    {
      "id": "DL-001",
      "name": "User Authentication",
      "acceptanceCriteria": [
        "User can login with email and password",
        "Invalid credentials show error message",
        "Session persists across page refresh"
      ],
      "passed": false
    }
  ]
}
```

### 5.3 State Persistence

| State                | Writer                       | Reader | Description                        |
| -------------------- | ---------------------------- | ------ | ---------------------------------- |
| Project Files        | Coding Agent (Direct)        | Both   | Application source code            |
| .autonoe/status.json | Deliverable Tools            | Both   | Deliverable tracking               |
| .autonoe-note.txt    | Coding Agent (Direct)        | Both   | Session handoff notes (agent-maintained) |
| Git History          | Coding Agent (Direct)        | Both   | Version control history            |

### 5.4 Configuration

**Configuration Sources:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Sources                         │
├─────────────────────────────────────────────────────────────────┤
│  Hardcoded (packages/core)                                       │
│  ├── sandbox: { enabled: true }                                  │
│  └── mcpServers: { playwright: {...} }                           │
│                                                                  │
│  Security Baseline (packages/core, always enforced)              │
│  ├── permissions.allow: [Read(./**), Write(./**), ...]           │
│  ├── allowedTools: [Read, Write, Edit, Glob, Grep, Bash]         │
│  └── hooks: [BashSecurity, .autonoe Protection]                  │
│                                                                  │
│  User Config (.autonoe/agent.json)                               │
│  ├── profile: "node" | ["node", "python"]  # Language profiles   │
│  ├── allowCommands: [...]      # Hook layer extensions           │
│  ├── allowPkillTargets: [...]  # Hook layer extensions           │
│  ├── permissions.allow: [...]  # SDK layer (Merged with baseline)│
│  ├── allowedTools: [...]       # Merged with baseline            │
│  └── mcpServers: { ... }       # Merged with built-in            │
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
| mcpServers       | Hardcoded + user  | SDK   | Merge          |

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

| Setting                  | Default | CLI Override   |
| ------------------------ | ------- | -------------- |
| enabled                  | true    | --no-sandbox   |
| autoAllowBashIfSandboxed | true    | -              |

```typescript
// Passed to SDK query() options
const sandboxSettings: SandboxSettings = {
  enabled: !options.noSandbox,  // --no-sandbox disables
  autoAllowBashIfSandboxed: true,
}
```

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

---

## 6. Security

### 6.1 Autonoe Security Controls

| Control              | Implementation              | Enforcement     |
| -------------------- | --------------------------- | --------------- |
| OS-Level Sandbox     | SandboxSettings.enabled     | SDK (hardcoded) |
| Bash Auto-Allow      | autoAllowBashIfSandboxed    | SDK (hardcoded) |
| Filesystem Scope     | permissions: ["./**"]       | SDK             |
| Bash Allowlist       | BashSecurity hook           | PreToolUse      |
| .autonoe/ Protection | PreToolUse hook             | PreToolUse      |

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

#### 6.3.2 Command Allowlists

**Base Profile** (always included):

| Category   | Commands                                 | Validation       |
| ---------- | ---------------------------------------- | ---------------- |
| Navigation | ls, pwd, cat, head, tail, wc, find, grep | Allowlist        |
| File Ops   | mkdir, cp, chmod                         | chmod: args      |
| Git        | git                                      | Allowlist        |
| Process    | echo, which, ps, lsof, sleep, pkill      | pkill: args      |
| Script     | bin/dev.sh                               | bin/dev.sh: args |

**Node.js Profile**:

| Category  | Commands                            |
| --------- | ----------------------------------- |
| Runtime   | node, bun, deno                     |
| Package   | npm, npx, yarn, pnpm                |
| Build     | tsc, esbuild, vite, webpack, rollup |
| Test      | jest, vitest, playwright, mocha     |
| Lint      | eslint, prettier, biome             |
| Framework | next, nuxt, astro, remix            |

**Python Profile**:

| Category  | Commands                               |
| --------- | -------------------------------------- |
| Runtime   | python, python3                        |
| Package   | pip, pip3, pipx, uv                    |
| Venv      | venv, virtualenv, conda                |
| Build     | poetry, pdm, hatch, flit               |
| Test      | pytest, tox, nox                       |
| Lint      | ruff, black, mypy, flake8, pylint      |
| Framework | django-admin, flask, uvicorn, gunicorn |

**Ruby Profile**:

| Category  | Commands                     |
| --------- | ---------------------------- |
| Runtime   | ruby, irb                    |
| Package   | gem, bundle, bundler         |
| Build     | rake, thor                   |
| Test      | rspec, minitest, cucumber    |
| Lint      | rubocop, standard            |
| Framework | rails, hanami, puma, unicorn |

**Go Profile**:

| Category | Commands                           |
| -------- | ---------------------------------- |
| Runtime  | go                                 |
| Format   | gofmt, goimports                   |
| Lint     | golint, golangci-lint, staticcheck |
| Tools    | gopls, dlv, goreleaser             |

#### 6.3.3 Argument Validation

Commands with `args` validation require additional checks:

**chmod validation**:

| Allowed                           | Blocked                               | Required           |
| --------------------------------- | ------------------------------------- | ------------------ |
| +x, u+x, g+x, o+x, a+x, ug+x, etc | -R (recursive), numeric modes (755)   | mode + target file |

**pkill validation** (per profile):

| Profile | Allowed Targets                    |
| ------- | ---------------------------------- |
| Base    | (none)                             |
| Node.js | node, npm, npx, vite, next         |
| Python  | python, python3, uvicorn, gunicorn |
| Ruby    | ruby, puma, unicorn, rails         |
| Go      | go                                 |

**bin/dev.sh validation**:

| Allowed                     | Blocked                          |
| --------------------------- | -------------------------------- |
| `./bin/dev.sh`, `bin/dev.sh`| Any arguments (prevent injection)|

#### 6.3.4 User Extensions

Users may add custom commands via `agent.json`:

```json
{
  "allowCommands": ["docker", "custom-cli"],
  "allowPkillTargets": ["custom-server"]
}
```

| Field             | Type       | Description                       |
| ----------------- | ---------- | --------------------------------- |
| allowCommands     | `string[]` | Additional commands to allowlist  |
| allowPkillTargets | `string[]` | Additional pkill target processes |

#### 6.3.5 Validation Flow

```
Command Input
     │
     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Parse Chain │────▶│ Extract Cmd │────▶│ Check Allow │
│ (&&,||,|,;) │     │ (basename)  │     │    List     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
             ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
             │   ALLOW     │            │    DENY     │            │ Needs Args  │
             │  (simple)   │            │  (blocked)  │            │ Validation  │
             └─────────────┘            └─────────────┘            └──────┬──────┘
                                                                          │
                                                                          ▼
                                                                   ┌─────────────┐
                                                                   │  Validate   │
                                                                   │  Arguments  │
                                                                   └──────┬──────┘
                                                                          │
                                                           ┌──────────────┴──────────────┐
                                                           ▼                             ▼
                                                    ┌─────────────┐               ┌─────────────┐
                                                    │   ALLOW     │               │    DENY     │
                                                    └─────────────┘               └─────────────┘
```

#### 6.3.6 Command Chain Handling

- Operators: `&&`, `||`, `|`, `;`
- Rule: If ANY command in chain is blocked, ENTIRE chain is denied
- Parse: Use shell-aware tokenizer (handle quotes, escapes)

---

## 7. Decision Table

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

| User Config (agent.json)    | Autonoe Behavior             |
| --------------------------- | ---------------------------- |
| Custom permissions          | Merge with security baseline |
| Custom hooks                | Merge with security baseline |
| Custom mcpServers           | Merge with built-in servers  |
| Custom allowCommands        | Merge with profile commands  |
| Disable sandbox             | Ignored, always enabled      |
| Remove .autonoe/ protection | Re-apply security baseline   |

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

## 8. Unit Test Scenarios

### 8.1 SessionRunner

| ID      | Input                              | Expected Output                         |
| ------- | ---------------------------------- | --------------------------------------- |
| SC-S001 | Project with SPEC.md               | Session starts successfully             |
| SC-S002 | No .autonoe/status.json            | Use initializerInstruction              |
| SC-S003 | All deliverables passed            | Session completes with success          |
| SC-S004 | maxIterations: 2, not all pass     | Loop stops after 2 sessions             |
| SC-S005 | Agent interruption                 | Session stops cleanly                   |
| SC-S006 | Result event (success)             | Result text + cost displayed via logger |
| SC-S007 | Result event (error)               | Error messages displayed via logger     |
| SC-S008 | All deliverables pass on iter 1    | Loop exits immediately with success     |
| SC-S009 | No maxIterations, partial progress | Loop continues to next session          |
| SC-S010 | delayBetweenSessions: 5000         | 5s delay observed between sessions      |

### 8.2 Bash Security

| ID      | Input                       | Expected Output                 |
| ------- | --------------------------- | ------------------------------- |
| SC-X001 | Allowed: `npm install`      | Command executed                |
| SC-X002 | Blocked: `rm -rf /`         | Command denied                  |
| SC-X004 | Chained with blocked cmd    | Entire command denied           |
| SC-X008 | `chmod +x script.sh`        | Allowed (executable permission) |
| SC-X009 | `chmod 777 file`            | Denied (numeric mode blocked)   |
| SC-X010 | `pkill node`                | Allowed (dev process)           |
| SC-X011 | `pkill postgres`            | Denied (non-dev process)        |
| SC-X012 | `chmod -R +x dir/`          | Denied (-R flag blocked)        |
| SC-X013 | `r\m -rf /`                 | Denied (backslash no bypass)    |
| SC-X014 | `echo "test\nvalue"`        | Allowed (escaped in quotes)     |
| SC-X015 | `""`                        | Allowed (empty command)         |
| SC-X016 | Hook with no command        | Approved (continue=true)        |
| SC-X017 | `./bin/dev.sh`              | Allowed (dev script)            |
| SC-X018 | `bin/dev.sh --flag`         | Denied (no args allowed)        |

### 8.3 Deliverable Tools (autonoe-deliverable)

| ID      | Tool                   | Input                          | Expected Output               |
| ------- | ---------------------- | ------------------------------ | ----------------------------- |
| DL-T001 | create_deliverable     | Array with valid deliverables  | All deliverables added        |
| DL-T002 | create_deliverable     | Array with duplicate ID        | Error: ID already exists      |
| DL-T003 | set_deliverable_status | Valid ID, passed=true          | status.json updated           |
| DL-T004 | set_deliverable_status | Invalid deliverable ID         | Error: deliverable not found  |
| DL-T010 | block_deliverable      | Valid ID, passed=false         | blocked=true                  |
| DL-T011 | block_deliverable      | Invalid ID                     | Error: NOT_FOUND              |
| DL-T012 | block_deliverable      | Valid ID, passed=true          | Error: MUTUAL_EXCLUSION       |

### 8.4 Configuration

| ID      | Input                                    | Expected Output                    |
| ------- | ---------------------------------------- | ---------------------------------- |
| SC-C001 | No agent.json                            | Use hardcoded settings only        |
| SC-C002 | User adds custom MCP server              | Merged with hardcoded mcpServers   |
| SC-C003 | User adds custom permissions             | Merged, security baseline enforced |
| SC-C004 | User adds custom hooks                   | Merged, security baseline enforced |
| SC-C005 | User tries to disable sandbox            | Ignored, sandbox always enabled    |
| SC-C006 | User tries to remove .autonoe protection | Security baseline re-applied       |
| SC-C007 | Verify sandbox configuration             | enabled=true, autoAllow=true       |

### 8.5 Language Profiles

| ID      | Profile Config         | Command         | Expected Output                    |
| ------- | ---------------------- | --------------- | ---------------------------------- |
| PR-X001 | (default)              | `npm install`   | Allowed (all profiles enabled)     |
| PR-X002 | (default)              | `pip install`   | Allowed (all profiles enabled)     |
| PR-X003 | (default)              | `go build`      | Allowed (all profiles enabled)     |
| PR-X004 | `"node"`               | `npm install`   | Allowed (node profile active)      |
| PR-X005 | `"node"`               | `pip install`   | Denied (python profile inactive)   |
| PR-X006 | `"python"`             | `pip install`   | Allowed (python profile active)    |
| PR-X007 | `"python"`             | `npm install`   | Denied (node profile inactive)     |
| PR-X008 | `["node", "python"]`   | `npm install`   | Allowed (node profile active)      |
| PR-X009 | `["node", "python"]`   | `pip install`   | Allowed (python profile active)    |
| PR-X010 | `["node", "python"]`   | `go build`      | Denied (go profile inactive)       |
| PR-X011 | (default) + custom     | `custom-cli`    | Allowed (allowCommands)            |
| PR-X012 | (default)              | `pkill uvicorn` | Allowed (python pkill targets)     |
| PR-X013 | `"node"`               | `pkill uvicorn` | Denied (python pkill targets only) |
| PR-X014 | (default) + custom     | `pkill custom`  | Allowed (allowPkillTargets)        |

### 8.6 Logger

| ID      | Input                        | Expected Output                 |
| ------- | ---------------------------- | ------------------------------- |
| SC-L001 | TestLogger captures info     | Message in entries with level   |
| SC-L002 | TestLogger captures debug    | Message in entries with level   |
| SC-L003 | silentLogger discards output | No side effects                 |
| SC-L004 | Session uses injected logger | Messages captured in TestLogger |
| SC-L005 | TestLogger captures warning  | Message in entries with level   |
| SC-L006 | TestLogger captures error    | Message in entries with level   |

### 8.7 Claude Agent Client

| ID       | Function             | Input                      | Expected Output                    |
| -------- | -------------------- | -------------------------- | ---------------------------------- |
| SC-AC001 | toSdkMcpServers      | Empty record               | Empty record                       |
| SC-AC002 | toSdkMcpServers      | Server with args           | SDK format preserved               |
| SC-AC003 | toStreamEvent        | text block                 | AgentText                          |
| SC-AC004 | toStreamEvent        | tool_use block             | ToolInvocation                     |
| SC-AC005 | toStreamEvent        | tool_result block          | ToolResponse                       |
| SC-AC006 | toResultSubtype      | 'success'                  | ResultSubtype.Success              |
| SC-AC007 | toResultSubtype      | 'error_max_turns'          | ResultSubtype.ErrorMaxTurns        |
| SC-AC008 | toResultSubtype      | 'error_during_execution'   | ResultSubtype.ErrorDuringExecution |
| SC-AC009 | toResultSubtype      | 'error_max_budget_usd'     | ResultSubtype.ErrorMaxBudgetUsd    |
| SC-AC010 | toResultSubtype      | unknown                    | ResultSubtype.ErrorDuringExecution |
| SC-AC011 | toStreamEvents       | SDK message with content   | Generator\<StreamEvent\>             |
| SC-AC012 | toSessionEnd         | Result with total_cost_usd | SessionEnd with totalCostUsd       |
| SC-AC013 | detectClaudeCodePath | claude found               | Path string                        |
| SC-AC014 | detectClaudeCodePath | claude not found           | undefined                          |

### 8.8 Autonoe Protection

| ID       | Input                              | Expected Output |
| -------- | ---------------------------------- | --------------- |
| SC-AP001 | file_path: `.autonoe/status.json`  | Block           |
| SC-AP002 | file_path: `src/index.ts`          | Approve         |
| SC-AP003 | file_path: `/abs/.autonoe/file`    | Block           |
| SC-AP004 | file_path: `./project/.autonoe/x`  | Block           |
| SC-AP005 | file_path: undefined               | Approve         |
| SC-AP006 | filePath (camelCase): `.autonoe/x` | Block           |
| SC-AP007 | Windows path: `.autonoe\\file`     | Block           |

---

## 9. Integration Test Scenarios

Integration tests require real SDK, Docker, and external services. They are separated from unit tests due to execution time and API costs.

### 9.1 Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Test Stack                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐                                              │
│  │    Makefile    │  make test-integration                       │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐                                              │
│  │ Docker Compose │  Isolated container environment              │
│  └───────┬────────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │   ./tmp/       │  │   autonoe      │  │   Artifacts    │     │
│  │   (workspace)  │◀─│   (CLI)        │─▶│   (output)     │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Test Execution Flow

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  Setup   │───▶│   Execute    │───▶│    Verify    │───▶│  Report  │
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘
     │                 │                   │                  │
     ▼                 ▼                   ▼                  ▼
- Clean ./tmp/    - docker compose    - Check files       - Exit code
- Copy fixtures     run --rm cli      - Validate JSON     - Summary
- Reset state     - autonoe run       - Content match
```

**Workspace Management:**

```bash
# Clean workspace (keep only .gitkeep)
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete

# Copy fixture for test
cp -r tests/integration/fixtures/hello-world/* ./tmp/
```

The `./tmp/` directory serves as the Docker volume mount point. Only `.gitkeep` is preserved to ensure the directory exists in version control.

### 9.3 Test Separation Strategy

| Test Type   | Location              | Command                 | CI Trigger      |
| ----------- | --------------------- | ----------------------- | --------------- |
| Unit        | `packages/*/tests/`   | `bun run test`          | Every commit    |
| Integration | `tests/integration/`  | `make test-integration` | Manual / Nightly |

### 9.4 Test Categories

| Category       | Scenarios       | Description                              |
| -------------- | --------------- | ---------------------------------------- |
| End-to-End     | IT-001 ~ IT-005 | Full workflow with CLI and deliverables  |
| SDK Sandbox    | SC-X003         | Filesystem boundary enforcement          |
| Browser        | SC-B001 ~ SC-B004 | Playwright MCP server integration      |

### 9.5 End-to-End Test Cases

#### IT-001: Basic Workflow

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **Scenario**     | End-to-end session with simple deliverable  |
| **Fixture**      | `tests/integration/fixtures/hello-world/`   |
| **Expected**     | `hello.txt` exists, content matches         |

```bash
# Setup
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
cp -r tests/integration/fixtures/hello-world/* ./tmp/

# Execute
docker compose run --rm cli autonoe run -n 3

# Verify
test -f ./tmp/hello.txt
grep -q "Hello, World!" ./tmp/hello.txt
```

#### IT-002: Technology Stack Recognition

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **Scenario**     | Node.js technology stack handling           |
| **Fixture**      | `tests/integration/fixtures/nodejs/`        |
| **Expected**     | `hello.js` exists, executes correctly       |

```bash
# Setup
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
cp -r tests/integration/fixtures/nodejs/* ./tmp/

# Execute
docker compose run --rm cli autonoe run -n 3

# Verify
test -f ./tmp/hello.js
docker compose run --rm cli node /workspace/hello.js | grep -q "Hello, World!"
```

#### IT-003: Instruction Override

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| **Scenario**     | Custom instruction loading                       |
| **Fixture**      | `tests/integration/fixtures/custom-instruction/` |
| **Expected**     | Agent outputs custom marker text                 |

```bash
# Setup
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
cp -r tests/integration/fixtures/custom-instruction/* ./tmp/

# Execute & Capture output
OUTPUT=$(docker compose run --rm cli autonoe run -d -n 2 2>&1)

# Verify
echo "$OUTPUT" | grep -q "=== CUSTOM MARKER ==="
```

#### IT-004: Deliverable Status Persistence

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **Scenario**     | Status file creation and update             |
| **Fixture**      | `tests/integration/fixtures/hello-world/`   |
| **Expected**     | Valid JSON with deliverable marked passed   |

```bash
# Setup
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
cp -r tests/integration/fixtures/hello-world/* ./tmp/

# Execute
docker compose run --rm cli autonoe run -n 3

# Verify
test -f ./tmp/.autonoe/status.json
jq -e '.deliverables[0].passed == true' ./tmp/.autonoe/status.json
```

#### IT-005: Session Iteration Limit

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **Scenario**     | Max iterations respected                    |
| **Fixture**      | `tests/integration/fixtures/hello-world/`   |
| **Expected**     | Exits after N iterations                    |

```bash
# Setup
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
cp -r tests/integration/fixtures/hello-world/* ./tmp/

# Execute with limit
docker compose run --rm cli autonoe run -n 1

# Verify (exits cleanly regardless of completion)
test $? -eq 0 || test $? -eq 1
```

### 9.6 SDK Sandbox Test Cases

| ID      | Input                     | Expected Output   |
| ------- | ------------------------- | ----------------- |
| SC-X003 | File read outside project | Permission denied |

```bash
# Setup - Create SPEC that requests reading /etc/passwd
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
cp -r tests/integration/fixtures/sandbox-test/* ./tmp/

# Execute
OUTPUT=$(docker compose run --rm cli autonoe run -d -n 2 2>&1)

# Verify - Agent should be blocked from reading outside project
echo "$OUTPUT" | grep -qi "permission denied\|not allowed\|blocked"
```

### 9.7 Browser Test Cases

| ID      | Input                  | Expected Output          |
| ------- | ---------------------- | ------------------------ |
| SC-B001 | Navigate to localhost  | Page loaded              |
| SC-B002 | Click without snapshot | Error: snapshot required |
| SC-B003 | Form submission        | Form submitted, verified |
| SC-B004 | Text verification      | Assertion passes/fails   |

```bash
# Setup - Start local web server and prepare fixture
find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
cp -r tests/integration/fixtures/browser-test/* ./tmp/

# Execute (web server runs inside container)
docker compose run --rm cli autonoe run -n 5

# Verify - Check browser interaction artifacts
test -f ./tmp/.autonoe/status.json
jq -e '.deliverables[] | select(.name | contains("Browser"))' ./tmp/.autonoe/status.json
```

### 9.8 Makefile Integration

```makefile
.PHONY: test test-unit test-integration test-all

test: test-unit

test-unit:
	bun run test

test-integration:
	@echo "Running integration tests..."
	./tests/integration/run.sh

test-all: test-unit test-integration
```

### 9.9 Integration Test Directory Structure

```
tests/
└── integration/
    ├── run.sh              # Main test runner script
    ├── fixtures/
    │   ├── hello-world/    # IT-001, IT-004, IT-005
    │   │   └── SPEC.md
    │   ├── nodejs/         # IT-002
    │   │   └── SPEC.md
    │   ├── custom-instruction/  # IT-003
    │   │   ├── SPEC.md
    │   │   └── .autonoe/
    │   │       └── initializer.md
    │   ├── sandbox-test/   # SC-X003
    │   │   └── SPEC.md
    │   └── browser-test/   # SC-B001 ~ SC-B004
    │       ├── SPEC.md
    │       └── server/     # Local web server for testing
    └── README.md
```

---

## 10. Build & Distribution

**Package Overview:**

| Package | Description |
|---------|-------------|
| root | Manages npm dependencies; child packages use `*` to inherit versions |
| @autonoe/core | Domain types and application logic (NO external dependencies) |
| @autonoe/agent | Wraps SDK, implements `AgentClient` interface from core |
| @autonoe/cli | Creates `ClaudeAgentClient`, injects into `SessionRunner` |

### 10.1 Workspace Configuration

```json
{
  "name": "autonoe",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "tsc -b",
    "test": "vitest",
    "format": "prettier --write .",
    "check": "tsc --noEmit",
    "compile": "bun build apps/cli/bin/autonoe.ts --compile --outfile dist/autonoe"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest"
  }
}
```

### 10.2 Package: core

```json
{
  "name": "@autonoe/core",
  "version": "0.1.0",
  "main": "src/index.ts"
}
```

### 10.3 Package: agent

```json
{
  "name": "@autonoe/agent",
  "version": "0.1.0",
  "main": "src/index.ts",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "*",
    "@autonoe/core": "workspace:*"
  }
}
```

### 10.4 Package: cli

```json
{
  "name": "@autonoe/cli",
  "version": "0.1.0",
  "bin": {
    "autonoe": "./bin/autonoe.ts"
  },
  "dependencies": {
    "@autonoe/core": "workspace:*",
    "@autonoe/agent": "workspace:*",
    "cac": "^6.7.14"
  }
}
```

### 10.5 Single Executable

```bash
bun build apps/cli/bin/autonoe.ts --compile --outfile dist/autonoe
bun build apps/cli/bin/autonoe.ts --compile --target=bun-linux-x64 --outfile dist/autonoe-linux
```

### 10.6 Docker Image Architecture

**Monorepo Docker Strategy**:

```
┌─────────────────────────────────────────────────────────┐
│                  ghcr.io/[org]/autonoe/                  │
├─────────────────────────────────────────────────────────┤
│  cli ─────────▶ apps/cli (Coding Agent CLI)              │
│  (future) ────▶ Other packages as needed                 │
└─────────────────────────────────────────────────────────┘
```

| Package | Image Path | Description |
|---------|------------|-------------|
| apps/cli | `ghcr.io/[org]/autonoe/cli` | Coding Agent CLI |

**Build Architecture (apps/cli)**:

```
┌─────────────────────────────────────────────────────────┐
│                     Dockerfile                          │
├─────────────────────────────────────────────────────────┤
│  builder ──▶ Compile autonoe binary                     │
│      │                                                  │
│      ├──▶ base (debian:bookworm-slim)                   │
│      │                                                  │
│      ├──▶ node (node:XX-bookworm-slim)                  │
│      │                                                  │
│      ├──▶ python (python:X.XX-slim-bookworm)            │
│      │                                                  │
│      ├──▶ golang (golang:X.XX-bookworm)                 │
│      │                                                  │
│      └──▶ ruby (ruby:X.X-slim-bookworm)                 │
└─────────────────────────────────────────────────────────┘
```

**Target Definition**:

| Target | Base Image                  | Tools Included                                    |
|--------|-----------------------------|-------------------------------------------------|
| base   | debian:bookworm-slim        | git, curl, ca-certificates                        |
| node   | node:XX-bookworm-slim       | git, curl, npm, Playwright deps                   |
| python | python:X.XX-slim-bookworm   | git, curl, Node.js, npm, Playwright deps, pip, venv |
| golang | golang:X.XX-bookworm        | git, curl, Node.js, npm, Playwright deps          |
| ruby   | ruby:X.X-slim-bookworm      | git, curl, Node.js, npm, Playwright deps, Bundler |

**Build Args**:

| Arg | Default | Description |
|-----|---------|-------------|
| `NODE_VERSION` | 24 | Node.js LTS |
| `PYTHON_VERSION` | 3.14 | Python stable |
| `GOLANG_VERSION` | 1.25 | Go stable |
| `RUBY_VERSION` | 4.0 | Ruby stable |

### 10.7 Container Registry

| Setting | Value |
|---------|-------|
| Registry | GitHub Container Registry |
| Path | `ghcr.io/[org]/autonoe/cli` |
| Default | `:latest` = `:base` |

**Tag Naming Convention**:

| Pattern | Example | Description |
|---------|---------|-------------|
| `:base` | `:base` | Minimal runtime (no language tools) |
| `:<lang>` | `:node`, `:python` | Language runtime with Node.js + Playwright |
| `:X.Y.Z-<variant>` | `:1.0.0-node` | Versioned tag |

### 10.8 Default Publish Matrix

| Tag | Tools | Use Case |
|-----|-------|----------|
| `:latest`, `:base` | git, curl | Minimal runtime |
| `:node` | Node.js, Playwright | Frontend development |
| `:python` | Python, pip, Node.js, Playwright | Backend / Data science |
| `:golang` | Go, Node.js, Playwright | System programming |
| `:ruby` | Ruby, Bundler, Node.js, Playwright | Web development |

### 10.9 Version Support Policy

| Language | Policy |
|----------|--------|
| Node.js | Current LTS |
| Python | Current stable |
| Golang | Current stable |
| Ruby | Current stable |

**Version Updates**:
- Default versions follow official LTS/stable releases
- Users can specify versions via Build Args for custom builds

### 10.10 Release Management

| Tool                     | Purpose                            |
| ------------------------ | ---------------------------------- |
| Release Please           | Version management, CHANGELOG      |
| Bun cross-compile        | Multi-platform binary distribution |
| docker/build-push-action | Multi-platform Docker images       |

**Release Flow:**

```
Push to main ─────────────────────────────────────────────────────┐
       │                                                          │
       ▼                                                          ▼
┌─────────────────────────────────────────┐            ┌─────────────────────────────┐
│              ci.yml                      │            │      release-please.yml     │
├─────────────────────────────────────────┤            ├─────────────────────────────┤
│  docker-latest:                          │            │  release-please:            │
│    Build :latest Docker images           │            │    Create/update release PR │
│                                          │            │                             │
│  build-snapshot:                         │            │         ▼ (on CLI release)  │
│    Bun cross-compile binaries            │            │  ┌──────┴──────┐            │
│    Upload as workflow artifacts          │            │  ▼             ▼            │
└─────────────────────────────────────────┘            │  docker-    binary-         │
       │                                                │  release    release         │
       ▼                                                └─────────────────────────────┘
┌─────────────────────────────────────────┐                   │             │
│  ghcr.io/.../cli:latest                  │                   ▼             ▼
│  ghcr.io/.../cli:base                    │            ┌─────────────────────────────┐
│  ghcr.io/.../cli:node                    │            │  ghcr.io/.../cli:X.Y.Z      │
│  ghcr.io/.../cli:python                  │            │  ghcr.io/.../cli:X.Y-node   │
│  ghcr.io/.../cli:golang                  │            │  ghcr.io/.../cli:X-python   │
│  ghcr.io/.../cli:ruby                    │            │  ...                        │
│                                          │            ├─────────────────────────────┤
│  GitHub Actions Artifacts (7 days)       │            │  GitHub Release Assets      │
│    └── binaries (snapshot)               │            │    ├── autonoe-linux-x64    │
└─────────────────────────────────────────┘            │    ├── autonoe-darwin-arm64 │
                                                        │    └── checksums.txt        │
                                                        └─────────────────────────────┘
```

**Workflow Structure:**

| Workflow             | Trigger      | Purpose                                              |
| -------------------- | ------------ | ---------------------------------------------------- |
| `ci.yml`             | Push to main | Docker latest + Bun snapshot binaries                |
| `release-please.yml` | Push to main | Release Please + versioned Docker + binary release   |

```yaml
# .github/workflows/ci.yml
jobs:
  docker-latest:    # Uses build-docker.yml reusable workflow
  build-snapshot:   # Uses build-binaries.yml reusable workflow

# .github/workflows/release-please.yml
jobs:
  release-please:   # Create release PR
  docker-release:   # Uses build-docker.yml reusable workflow
  binary-build:     # Uses build-binaries.yml reusable workflow
  binary-release:   # Downloads artifacts, uploads to GitHub Release
```

### 10.10.1 Reusable Workflow Architecture

**Unified Approach:**

| Component | Type | Location | Purpose |
|-----------|------|----------|---------|
| Docker builds | Reusable Workflow | `.github/workflows/build-docker.yml` | Job-level reuse with matrix strategy |
| Binary builds | Reusable Workflow | `.github/workflows/build-binaries.yml` | Job-level reuse with matrix strategy |

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Reusable Workflow Architecture                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Caller Workflows          Reusable Workflows                   │
│  ┌──────────────────┐     ┌────────────────┐                    │
│  │  ci.yml          │     │ build-docker   │                    │
│  │    docker-latest │────▶│   .yml         │                    │
│  │    build-snapshot│────▶│ (matrix: 5x)   │                    │
│  └──────────────────┘     └────────────────┘                    │
│                                 │                                │
│  ┌──────────────────┐     ┌────────────────┐                    │
│  │  release-please  │     │ build-binaries │                    │
│  │    docker-release│────▶│   .yml         │                    │
│  │    binary-build  │────▶│ (matrix: 5x)   │                    │
│  │    binary-release│     └────────────────┘                    │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

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

## 11. CLI

### 11.1 Usage

```
autonoe run [options]

Options:
  --project-dir, -p       Project directory (default: cwd)
  --max-iterations, -n    Maximum coding sessions
  --model, -m             Claude model to use
  --debug, -d             Show debug output
  --no-sandbox            Disable SDK sandbox
```

### 11.2 Behavior

- Runs in specified project directory (or cwd if not specified)
- All relative paths (.autonoe/, SPEC.md) resolved from project directory
- Reads `SPEC.md` for project specification
- Recommends using Gherkin (`.feature` files) to define acceptance criteria
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
  .option('-m, --model <model>', 'Claude model to use')
  .option('-d, --debug', 'Show debug output')
  .option('--no-sandbox', 'Disable SDK sandbox')
  .action((options) => {
    // Run session with options
  })

cli.help()
cli.version('0.1.0')
cli.parse()
```

---

## Appendix A: Instructions

### A.1 File Structure

```
packages/core/
├── src/
│   ├── instructions.ts
│   └── instructions/
│       ├── initializer.md
│       └── coding.md
└── markdown.d.ts
```

### A.2 Import Method

```typescript
// packages/core/src/instructions.ts
import initializerInstruction from './instructions/initializer.md' with { type: 'text' }
import codingInstruction from './instructions/coding.md' with { type: 'text' }

export { initializerInstruction, codingInstruction }
```

```typescript
// packages/core/markdown.d.ts
declare module '*.md' {
  const content: string
  export default content
}
```

### A.3 Instruction Usage

| Instruction            | Condition                   |
| ---------------------- | --------------------------- |
| initializerInstruction | No .autonoe/status.json     |
| codingInstruction      | .autonoe/status.json exists |

### A.4 Instruction Override

```
Instruction Resolution
┌──────────────────────────────────────────────────────┐
│  .autonoe/{name}.md  →  packages/core instruction    │
│                         (fallback if not exists)     │
└──────────────────────────────────────────────────────┘
```

| Override File           | Fallback               | Purpose                    |
| ----------------------- | ---------------------- | -------------------------- |
| .autonoe/initializer.md | initializerInstruction | Custom initialization flow |
| .autonoe/coding.md      | codingInstruction      | Custom implementation flow |
