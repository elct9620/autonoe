# Autonoe Specification

## 1. System Overview

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Autonoe                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌────────────────┐   ┌────────────────────────┐  │
│  │    apps/cli    │───▶│ packages/core  │   │ packages/               │  │
│  │  (Entry Point) │    │ (Orchestrator) │◀──│ claude-agent-client    │  │
│  └───────┬────────┘    └───────┬────────┘   │ (SDK Wrapper)          │  │
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
├── .goreleaser.yaml
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
│   │   │   ├── statusTools.ts
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
│   └── claude-agent-client/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts
│           ├── claudeAgentClient.ts
│           ├── claudeCodePath.ts
│           └── converters.ts
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
│       packages/core             │  │  packages/claude-agent-client   │
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
     (packages/core)         (packages/claude-agent-client)
```

- `packages/core` has NO external dependencies (pure domain + application)
- `packages/claude-agent-client` depends on `@autonoe/core` for types
- `apps/cli` creates infrastructure and injects into application layer

### 2.3 Domain Model

#### Value Objects

**AgentMessage** - Base message from coding agent

| Field | Type | Description |
|-------|------|-------------|
| type | AgentMessageType | Message type discriminator |

**ResultMessage** - Execution result (extends AgentMessage)

| Field | Type | Description |
|-------|------|-------------|
| type | AgentMessageType.Result | Fixed to Result |
| subtype | ResultSubtype | Execution outcome |
| result | string? | Output text (on success) |
| errors | string[]? | Error messages (on failure) |
| totalCostUsd | number? | API cost in USD |

**McpServer** - External tool server configuration

| Field | Type | Description |
|-------|------|-------------|
| command | string | Server executable command |
| args | string[]? | Command arguments |

#### Enums

**AgentMessageType** - Message type discriminator

| Value | Description |
|-------|-------------|
| Text | Text content message |
| Result | Execution result message |

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
| MessageStream | AsyncIterable\<AgentMessage\> | Async stream of agent messages |

**Type Definitions:** See `packages/core/src/types.ts`

---

## 3. Core Interfaces

### 3.1 AgentClient

```typescript
// packages/core/src/agentClient.ts
interface AgentClient {
  query(instruction: string): MessageStream
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
  scenariosPassedCount: number
  scenariosTotalCount: number
}
```

**Responsibilities:**

| Responsibility           | Description                              |
| ------------------------ | ---------------------------------------- |
| Single execution         | One agent query cycle                    |
| Cost tracking            | Track API cost for this session          |
| Duration tracking        | Measure execution time                   |
| Debug logging            | Log message sending/receiving (debug)    |
| Result display           | Display result text via logger.info      |
| Error display            | Display error messages via logger.error  |

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

### 3.5 Status Management Tools (SDK Custom Tools)

#### 3.5.1 Tool Registration

```typescript
// packages/core/src/statusTools.ts
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const statusServer = createSdkMcpServer({
  name: 'autonoe-status',
  version: '1.0.0',
  tools: [createScenarioTool, updateStatusTool]
})
```

#### 3.5.2 createScenario Tool

```typescript
const createScenarioTool = tool(
  'create_scenario',
  'Create a new scenario in status.json',
  {
    id: z.string(),
    feature: z.string(),
    name: z.string()
  },
  async ({ id, feature, name }) => { /* ... */ }
)
```

#### 3.5.3 updateStatus Tool

```typescript
const updateStatusTool = tool(
  'update_status',
  'Update scenario passed status',
  {
    scenarioId: z.string(),
    passed: z.boolean()
  },
  async ({ scenarioId, passed }) => { /* ... */ }
)
```

#### 3.5.4 Tool Usage

| Tool            | Phase          | Operation       |
| --------------- | -------------- | --------------- |
| create_scenario | Initialization | Create scenario |
| update_status   | Coding         | Mark passed     |

### 3.6 Dependency Injection

| Component       | Injected Via              | Purpose                   |
| --------------- | ------------------------- | ------------------------- |
| AgentClient     | SessionRunner.run()       | Enable testing with mocks |
| BashSecurity    | PreToolUse hook           | Validate bash commands    |
| create_scenario | SDK createSdkMcpServer    | Create scenarios          |
| update_status   | SDK createSdkMcpServer    | Update scenario status    |
| Logger          | SessionRunner.run()       | Enable output capture     |

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
  error(message: string): void
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
│  │   │    if (allScenariosPassed) break         │              │  │
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

#### 3.8.3 Client Reuse

| Per Session                | Shared                    |
| -------------------------- | ------------------------- |
| instruction                | cwd, permissionMode       |
|                            | mcpServers, hooks         |

#### 3.8.4 SessionRunner Interface

```typescript
// packages/core/src/sessionRunner.ts
interface SessionRunner {
  run(client: AgentClient, logger: Logger): Promise<SessionRunnerResult>
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
  scenariosPassedCount: number
  scenariosTotalCount: number
  totalDuration: number
}
```

### 3.9 Termination Conditions

| Priority | Condition              | Check                          | Result        |
| -------- | ---------------------- | ------------------------------ | ------------- |
| 1        | All scenarios passed   | status.json: all passed=true   | success=true  |
| 2        | Max iterations reached | iteration >= maxIterations     | success=false |
| 3        | User interrupt         | SIGINT received                | success=false |

> Default: When --max-iterations not specified, loop continues until all scenarios pass.

---

## 4. Browser Automation (Coding Agent)

> Tools available to the Coding Agent via Playwright MCP server.

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
└── .autonoe/
    └── status.json
```

### 5.2 Status Tracking (.autonoe/status.json)

```json
{
  "scenarios": [
    {
      "id": "SC-F001",
      "feature": "authentication.feature",
      "name": "Successful login",
      "passed": false
    }
  ]
}
```

### 5.3 State Persistence

| State                | Writer                               | Reader |
| -------------------- | ------------------------------------ | ------ |
| Project Files        | Coding Agent (Direct)                | Both   |
| .autonoe/status.json | create_scenario / update_status Tool | Both   |
| Git History          | Coding Agent (Direct)                | Both   |

### 5.4 Configuration

**Configuration Sources:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Sources                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Hardcoded (packages/core)                                       │
│  ├── sandbox: { enabled: true }                                  │
│  └── mcpServers: { playwright: {...} }                           │
│                                                                  │
│  Security Baseline (packages/core, always enforced)              │
│  ├── permissions: ["./**"]                                       │
│  └── hooks: [BashSecurity, .autonoe Protection]                  │
│                                                                  │
│  User Config (.autonoe/agent.json)                               │
│  ├── permissions: { ... }  # Merged with baseline                │
│  ├── hooks: { ... }        # Merged with baseline                │
│  └── mcpServers: { ... }   # Merged with built-in                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Setting               | Source     | Customizable | Note                               |
| --------------------- | ---------- | ------------ | ---------------------------------- |
| sandbox               | Hardcoded  | NO           | Always enabled                     |
| permissions           | agent.json | YES          | Autonoe enforces security baseline |
| hooks                 | agent.json | YES          | Autonoe enforces security baseline |
| mcpServers (built-in) | Hardcoded  | NO           |                                    |
| mcpServers (custom)   | agent.json | YES          |                                    |

**agent.json Structure:**

```json
{
  "permissions": {
    "allow": ["Read(./docs/**)"]
  },
  "hooks": {
    "PreToolUse": ["custom-validator"]
  },
  "mcpServers": {
    "custom-tool": {
      "command": "npx",
      "args": ["custom-mcp-server"]
    }
  }
}
```

**Runtime Merge Flow:**

```
Load hardcoded ──▶ Load security baseline ──▶ Read agent.json ──▶ Merge (enforce baseline) ──▶ Pass to SDK
```

### 5.5 SDK Sandbox Configuration

**SandboxSettings (Hardcoded, NOT customizable):**

| Setting                  | Value | Purpose                      |
| ------------------------ | ----- | ---------------------------- |
| enabled                  | true  | Enable OS-level isolation    |
| autoAllowBashIfSandboxed | true  | Auto-approve bash in sandbox |

```typescript
// Passed to SDK query() options
const sandboxSettings: SandboxSettings = {
  enabled: true,
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

The Coding Agent operates under these constraints:

| Resource      | Direct Access | Tool Access            | Enforcement                       |
| ------------- | ------------- | ---------------------- | --------------------------------- |
| Project Files | R/W           | -                      | SDK permissions                   |
| .autonoe/     | Read-only     | Write (status tools)   | PreToolUse hook blocks direct W/E |
| Bash Commands | -             | Limited allowlist      | BashSecurity hook                 |

### 6.3 Allowed Commands

| Category   | Commands                                 |
| ---------- | ---------------------------------------- |
| Navigation | ls, pwd, cd, cat, head, tail, find, grep |
| File Ops   | mkdir, cp                                |
| Git        | git                                      |
| Node.js    | node, npm, npx                           |
| Build      | tsc, esbuild, vite                       |
| Test       | jest, vitest, playwright                 |
| Process    | echo, which                              |

---

## 7. Decision Table

### 7.1 Session Loop Behavior

| .autonoe/status.json | --max-iterations | Action                              |
| -------------------- | ---------------- | ----------------------------------- |
| NOT EXISTS           | any              | Use initializerInstruction, continue |
| EXISTS (none passed) | any              | Run all scenarios                   |
| EXISTS (partial)     | any              | Run scenarios with passed=false     |
| EXISTS (all passed)  | any              | Exit loop, success                  |
| any                  | reached limit    | Exit loop, partial                  |
| any                  | undefined        | Continue until all pass             |

### 7.2 Coding Agent Tool Availability

Tools available to the Coding Agent (configured by Autonoe):

| Tool Category   | Available |
| --------------- | --------- |
| File Read       | YES       |
| File Write      | YES       |
| Bash (safe)     | YES       |
| Git             | YES       |
| Playwright      | YES       |
| autonoe-status  | YES       |

### 7.3 Instruction Selection

| Condition                   | Instruction              |
| --------------------------- | ------------------------ |
| No .autonoe/status.json     | initializerInstruction   |
| .autonoe/status.json exists | codingInstruction        |

### 7.4 Configuration Merge

| User Config (agent.json)    | Autonoe Behavior             |
| --------------------------- | ---------------------------- |
| Custom permissions          | Merge with security baseline |
| Custom hooks                | Merge with security baseline |
| Custom mcpServers           | Merge with built-in servers  |
| Disable sandbox             | Ignored, always enabled      |
| Remove .autonoe/ protection | Re-apply security baseline   |

---

## 8. Unit Test Scenarios

### 8.1 SessionRunner

| ID      | Input                              | Expected Output                         |
| ------- | ---------------------------------- | --------------------------------------- |
| SC-S001 | Project with SPEC.md               | Session starts successfully             |
| SC-S002 | No .autonoe/status.json            | Use initializerInstruction              |
| SC-S003 | All scenarios passed               | Session completes with success          |
| SC-S004 | maxIterations: 2, not all pass     | Loop stops after 2 sessions             |
| SC-S005 | Agent interruption                 | Session stops cleanly                   |
| SC-S006 | Result event (success)             | Result text + cost displayed via logger |
| SC-S007 | Result event (error)               | Error messages displayed via logger     |
| SC-S008 | All scenarios pass on iteration 1  | Loop exits immediately with success     |
| SC-S009 | No maxIterations, partial progress | Loop continues to next session          |
| SC-S010 | delayBetweenSessions: 5000         | 5s delay observed between sessions      |

### 8.2 Bash Security

| ID      | Input                    | Expected Output       |
| ------- | ------------------------ | --------------------- |
| SC-X001 | Allowed: `npm install`   | Command executed      |
| SC-X002 | Blocked: `rm -rf /`      | Command denied        |
| SC-X004 | Chained with blocked cmd | Entire command denied |

### 8.3 Status Tools (autonoe-status)

| ID      | Tool            | Input                      | Expected Output           |
| ------- | --------------- | -------------------------- | ------------------------- |
| SC-T001 | create_scenario | Valid scenario input       | Scenario added to status  |
| SC-T002 | create_scenario | Duplicate scenario ID      | Error: already exists     |
| SC-T003 | update_status   | Valid ID, passed=true      | status.json updated       |
| SC-T004 | update_status   | Invalid scenario ID        | Error: scenario not found |

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

### 8.5 Logger

| ID      | Input                        | Expected Output                 |
| ------- | ---------------------------- | ------------------------------- |
| SC-L001 | TestLogger captures info     | Message in entries with level   |
| SC-L002 | TestLogger captures debug    | Message in entries with level   |
| SC-L003 | silentLogger discards output | No side effects                 |
| SC-L004 | Session uses injected logger | Messages captured in TestLogger |
| SC-L005 | TestLogger captures warning  | Message in entries with level   |
| SC-L006 | TestLogger captures error    | Message in entries with level   |

### 8.6 Claude Agent Client

| ID       | Function             | Input                      | Expected Output                    |
| -------- | -------------------- | -------------------------- | ---------------------------------- |
| SC-AC001 | toSdkMcpServers      | Empty record               | Empty record                       |
| SC-AC002 | toSdkMcpServers      | Server with args           | SDK format preserved               |
| SC-AC003 | toAgentMessageType   | 'text'                     | AgentMessageType.Text              |
| SC-AC004 | toAgentMessageType   | 'result'                   | AgentMessageType.Result            |
| SC-AC005 | toAgentMessageType   | unknown                    | AgentMessageType.Text              |
| SC-AC006 | toResultSubtype      | 'success'                  | ResultSubtype.Success              |
| SC-AC007 | toResultSubtype      | 'error_max_turns'          | ResultSubtype.ErrorMaxTurns        |
| SC-AC008 | toResultSubtype      | 'error_during_execution'   | ResultSubtype.ErrorDuringExecution |
| SC-AC009 | toResultSubtype      | 'error_max_budget_usd'     | ResultSubtype.ErrorMaxBudgetUsd    |
| SC-AC010 | toResultSubtype      | unknown                    | ResultSubtype.ErrorDuringExecution |
| SC-AC011 | toAgentMessage       | Text message               | Domain AgentMessage                |
| SC-AC012 | toAgentMessage       | Result with total_cost_usd | totalCostUsd (camelCase)           |
| SC-AC013 | detectClaudeCodePath | claude found               | Path string                        |
| SC-AC014 | detectClaudeCodePath | claude not found           | undefined                          |

---

## 9. Integration Test Scenarios

### 9.1 Security (SDK)

| ID      | Input                              | Expected Output                |
| ------- | ---------------------------------- | ------------------------------ |
| SC-X003 | File read outside project          | Permission denied              |
| SC-X005 | Direct write to .autonoe/          | Permission denied (PreToolUse) |
| SC-X006 | Direct edit .autonoe/status.json   | Permission denied (PreToolUse) |
| SC-X007 | update_status tool write status    | Allowed                        |

### 9.2 Browser

| ID      | Input                  | Expected Output          |
| ------- | ---------------------- | ------------------------ |
| SC-B001 | Navigate to localhost  | Page loaded              |
| SC-B002 | Click without snapshot | Error: snapshot required |
| SC-B003 | Form submission        | Form submitted, verified |
| SC-B004 | Text verification      | Assertion passes/fails   |

---

## 10. Build & Distribution

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

> Note: External npm dependencies are managed in root package.json. Child packages use `*` to inherit the resolved version.

### 10.2 Package: core

```json
{
  "name": "@autonoe/core",
  "version": "0.1.0",
  "main": "src/index.ts"
}
```

> Note: `packages/core` has NO external dependencies. Domain types and application logic only.

### 10.3 Package: claude-agent-client

```json
{
  "name": "@autonoe/claude-agent-client",
  "version": "0.1.0",
  "main": "src/index.ts",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "*",
    "@autonoe/core": "workspace:*"
  }
}
```

> Wraps `@anthropic-ai/claude-agent-sdk` and implements `AgentClient` interface from `@autonoe/core`.

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
    "@autonoe/claude-agent-client": "workspace:*",
    "cac": "^6.7.14"
  }
}
```

> CLI creates `ClaudeAgentClient` and injects it into `SessionRunner` from core.

### 10.5 Single Executable

```bash
bun build apps/cli/bin/autonoe.ts --compile --outfile dist/autonoe
bun build apps/cli/bin/autonoe.ts --compile --target=bun-linux-x64 --outfile dist/autonoe-linux
```

### 10.6 Docker

```dockerfile
FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bun build apps/cli/bin/autonoe.ts --compile --outfile autonoe

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    git \
    curl \
    # Playwright dependencies
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/autonoe /usr/local/bin/autonoe
ENTRYPOINT ["autonoe"]
```

### 10.7 Release Management

| Tool           | Purpose                            |
| -------------- | ---------------------------------- |
| Release Please | Version management, CHANGELOG      |
| GoReleaser     | Multi-platform binary distribution |

```yaml
# .github/workflows/release.yml
- uses: googleapis/release-please-action@v4
- uses: goreleaser/goreleaser-action@v6
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

Uses CAC for argument parsing. CAC was chosen for:

- Zero nested dependencies (single file)
- TypeScript-first design
- Minimal API (4 methods)
- Automatic help/version generation

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
