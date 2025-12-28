# Autonoe Specification

## 1. System Overview

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Autonoe                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌────────────────┐                               │
│  │    apps/cli    │───▶│ packages/core  │                               │
│  │  (Entry Point) │    │ (Orchestrator) │                               │
│  └────────────────┘    └───────┬────────┘                               │
│                                │                                         │
│                                │ Creates & Controls                      │
│                                ▼                                         │
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

### 1.3 Coding Agent Tools (MCP Servers)

| Tool        | MCP Server     | Purpose                  |
| ----------- | -------------- | ------------------------ |
| Browser     | Playwright MCP | E2E testing via browser  |
| File System | Built-in       | Read/Write project files |
| Bash        | Built-in       | Execute allowed commands |

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
│   └── core/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── markdown.d.ts
│       ├── src/
│       │   ├── index.ts
│       │   ├── agentClient.ts
│       │   ├── session.ts
│       │   ├── statusTool.ts
│       │   ├── bashSecurity.ts
│       │   ├── prompts.ts
│       │   ├── mockAgentClient.ts
│       │   └── prompts/
│       │       ├── initializer.md
│       │       └── coding.md
│       └── tests/
│           ├── session.test.ts
│           ├── statusTool.test.ts
│           └── bashSecurity.test.ts
└── apps/
    └── cli/
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts
        │   └── run.ts
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
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      packages/core                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Application Layer                       │  │
│  │  Session orchestration, use cases                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Domain Layer                          │  │
│  │  ValidationResult                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Infrastructure Layer                      │  │
│  │  AgentClient, file I/O, prompts                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Dependency Rule

```
Presentation → Application → Domain ← Infrastructure
                    ↓
              Infrastructure
```

---

## 3. Core Interfaces

### 3.1 AgentClient

```typescript
// packages/core/src/agentClient.ts
interface AgentClient {
  query(message: string): Query
}

interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>
}

interface QueryOptions {
  cwd: string
  mcpServers: Record<string, McpServerConfig>
  permissionMode: PermissionMode
  hooks: HookConfig
  allowedTools: string[]
  systemPrompt: string | SystemPromptPreset
}

type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions'
```

### 3.2 MockAgentClient

```typescript
// packages/core/src/mockAgentClient.ts
class MockAgentClient implements AgentClient {
  private responses: SDKMessage[] = []

  setResponses(responses: SDKMessage[]): void
  query(message: string): Query
}
```

### 3.3 Session

```typescript
// packages/core/src/session.ts
interface Session {
  run(client: AgentClient): Promise<SessionResult>
}

interface SessionOptions {
  projectDir: string
  maxIterations?: number
  delayBetweenSessions?: number
}

interface SessionResult {
  success: boolean
  scenariosPassedCount: number
  scenariosTotalCount: number
  duration: number
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

### 3.5 StatusTool (Autonoe Tool)

```typescript
// packages/core/src/statusTool.ts
interface StatusTool {
  updateStatus(scenarioId: string, passed: boolean): Promise<void>
}
```

> Registered via Agent SDK as custom tool

### 3.6 Dependency Injection

| Component    | Injected Via      | Purpose                   |
| ------------ | ----------------- | ------------------------- |
| AgentClient  | Session.run()     | Enable testing with mocks |
| BashSecurity | PreToolUse hook   | Validate bash commands    |
| StatusTool   | MCP Server config | Update scenario status    |

```
Session(options) ──▶ run(client) ──▶ client.query()
         │                │
    Configuration    Dependency
```

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

> Generated and managed by Prompt, structure kept minimal

### 5.3 State Persistence

| State                | Writer                        | Reader |
| -------------------- | ----------------------------- | ------ |
| Project Files        | Coding Agent (Direct)         | Both   |
| .autonoe/status.json | Coding Agent (via StatusTool) | Both   |
| Git History          | Coding Agent (Direct)         | Both   |

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

---

## 6. Security

### 6.1 Autonoe Security Controls

Autonoe applies the following controls when creating the Coding Agent:

| Control              | Method            | Description                 |
| -------------------- | ----------------- | --------------------------- |
| OS-Level Sandbox     | SDK Configuration | Isolates agent execution    |
| Filesystem Scope     | SDK Permissions   | Limits to project directory |
| Bash Allowlist       | PreToolUse Hook   | Filters unsafe commands     |
| .autonoe/ Protection | PreToolUse Hook   | Blocks direct writes        |

### 6.2 Coding Agent Restrictions

The Coding Agent operates under these constraints:

| Resource      | Direct Access | Tool Access        | Enforcement                       |
| ------------- | ------------- | ------------------ | --------------------------------- |
| Project Files | R/W           | -                  | SDK permissions                   |
| .autonoe/     | Read-only     | Write (StatusTool) | PreToolUse hook blocks direct W/E |
| Bash Commands | -             | Limited allowlist  | BashSecurity hook                 |

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

### 7.1 Session Behavior

| .autonoe/status.json | Action                          |
| -------------------- | ------------------------------- |
| NOT EXISTS           | Use initializerPrompt           |
| EXISTS (no passed)   | Run all scenarios               |
| EXISTS (partial)     | Run scenarios with passed=false |
| EXISTS (all passed)  | Complete, exit                  |

### 7.2 Coding Agent Tool Availability

Tools available to the Coding Agent (configured by Autonoe):

| Tool Category | Available |
| ------------- | --------- |
| File Read     | YES       |
| File Write    | YES       |
| Bash (safe)   | YES       |
| Git           | YES       |
| Playwright    | YES       |
| StatusTool    | YES       |

### 7.3 Prompt Selection

| Condition                   | Prompt Used       |
| --------------------------- | ----------------- |
| No .autonoe/status.json     | initializerPrompt |
| .autonoe/status.json exists | codingPrompt      |

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

### 8.1 Session

| ID      | Input                   | Expected Output                 |
| ------- | ----------------------- | ------------------------------- |
| SC-S001 | Project with SPEC.md    | Session starts successfully     |
| SC-S002 | No .autonoe/status.json | Use initializerPrompt           |
| SC-S003 | All scenarios passed    | Session completes with success  |
| SC-S004 | Max iterations reached  | Session stops, partial progress |
| SC-S005 | Agent interruption      | Session stops cleanly           |

### 8.2 Bash Security

| ID      | Input                    | Expected Output       |
| ------- | ------------------------ | --------------------- |
| SC-X001 | Allowed: `npm install`   | Command executed      |
| SC-X002 | Blocked: `rm -rf /`      | Command denied        |
| SC-X004 | Chained with blocked cmd | Entire command denied |

### 8.3 StatusTool

| ID      | Input                      | Expected Output           |
| ------- | -------------------------- | ------------------------- |
| SC-T001 | Update status: passed=true | status.json updated       |
| SC-T002 | Update invalid scenario ID | Error: scenario not found |

### 8.4 Configuration

| ID      | Input                                    | Expected Output                    |
| ------- | ---------------------------------------- | ---------------------------------- |
| SC-C001 | No agent.json                            | Use hardcoded settings only        |
| SC-C002 | User adds custom MCP server              | Merged with hardcoded mcpServers   |
| SC-C003 | User adds custom permissions             | Merged, security baseline enforced |
| SC-C004 | User adds custom hooks                   | Merged, security baseline enforced |
| SC-C005 | User tries to disable sandbox            | Ignored, sandbox always enabled    |
| SC-C006 | User tries to remove .autonoe protection | Security baseline re-applied       |

---

## 9. Integration Test Scenarios

### 9.1 Security (SDK)

| ID      | Input                            | Expected Output                |
| ------- | -------------------------------- | ------------------------------ |
| SC-X003 | File read outside project        | Permission denied              |
| SC-X005 | Direct write to .autonoe/        | Permission denied (PreToolUse) |
| SC-X006 | Direct edit .autonoe/status.json | Permission denied (PreToolUse) |
| SC-X007 | StatusTool update status.json    | Allowed                        |

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
  "main": "src/index.ts",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "*"
  }
}
```

> Note: `workspace:*` is only for local workspace packages (e.g., `@autonoe/core`). Use `*` for npm packages to inherit from root.

### 10.3 Package: cli

```json
{
  "name": "@autonoe/cli",
  "version": "0.1.0",
  "bin": {
    "autonoe": "./bin/autonoe.ts"
  },
  "dependencies": {
    "@autonoe/core": "workspace:*",
    "cac": "^6.7.14"
  }
}
```

### 10.4 Single Executable

```bash
bun build apps/cli/bin/autonoe.ts --compile --outfile dist/autonoe
bun build apps/cli/bin/autonoe.ts --compile --target=bun-linux-x64 --outfile dist/autonoe-linux
```

### 10.5 Docker

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

### 10.6 Release Management

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
  --max-iterations, -n    Maximum coding sessions
  --model, -m             Claude model to use
```

### 11.2 Behavior

- Runs in current working directory
- Reads `SPEC.md` for project specification
- Recommends using Gherkin (`.feature` files) to define acceptance criteria
- Agent SDK auto-detects API credentials
- Shows help message when no command is provided

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
  .option('-n, --max-iterations <count>', 'Maximum coding sessions')
  .option('-m, --model <model>', 'Claude model to use')
  .action((options) => {
    // Run session with options
  })

cli.help()
cli.version('0.1.0')
cli.parse()
```

---

## Appendix A: Prompts

### A.1 File Structure

```
packages/core/
├── src/
│   ├── prompts.ts
│   └── prompts/
│       ├── initializer.md
│       └── coding.md
└── markdown.d.ts
```

### A.2 Import Method

```typescript
// packages/core/src/prompts.ts
import initializerPrompt from './prompts/initializer.md' with { type: 'text' }
import codingPrompt from './prompts/coding.md' with { type: 'text' }

export { initializerPrompt, codingPrompt }
```

```typescript
// packages/core/markdown.d.ts
declare module '*.md' {
  const content: string
  export default content
}
```

### A.3 Prompt Usage

| Prompt            | Condition                   |
| ----------------- | --------------------------- |
| initializerPrompt | No .autonoe/status.json     |
| codingPrompt      | .autonoe/status.json exists |
