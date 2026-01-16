# Autonoe Specification

## Table of Contents

### Intent Layer
- [0. Intent](#0-intent-intent)

### Design Layer
- [1. System Overview](#1-system-overview-design)
- [2. Clean Architecture](#2-clean-architecture-design)
  - [Domain Model](docs/domain-model.md)
- [3. Core Interfaces](#3-core-interfaces-design)
  - [Interfaces](docs/interfaces.md)
- [4. Browser Automation](#4-browser-automation-design)
- [5. State Management](#5-state-management-design)
- [6. Security](#6-security-design)
  - [Security Details](docs/security.md)
- [7. Build & Distribution](#7-build--distribution-design)
  - [Docker Configuration](docs/docker.md)
- [8. CLI](#8-cli-design)
- [Appendix A: Instructions](#appendix-a-instructions-design)

### Consistency Layer
- [9. Decision Table](#9-decision-table-consistency)
- [Test Scenarios](docs/testing.md)

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

### 0.5 Non-goals

| Non-goal | Rationale |
|----------|-----------|
| Specification authoring | User writes SPEC.md; Autonoe implements it |
| Interactive development | Autonomous execution; human-in-loop handled by external tools |
| Deployment automation | Scope ends at code generation and verification |
| Runtime monitoring | Focus on development phase, not production operation |

---

## 1. System Overview `[Design]`

### 1.1 Architecture

```text
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
│  │  │  │  Browser    │  │  Built-in   │  │   File System         │    │││
│  │  │  │  Automation │  │  (Bash)     │  │   (Read/Write)        │    │││
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

| Tool               | Source                         | Purpose                             |
| ------------------ | ------------------------------ | ----------------------------------- |
| Browser Automation | Playwright MCP (pre-installed) | UI verification and E2E testing     |
| File System        | SDK Built-in                   | Read/Write project files            |
| Bash               | SDK Built-in                   | Execute allowed commands            |

### 1.4 Coding Conventions

See `CLAUDE.md` for TypeScript coding conventions used in this project.

---

## 2. Clean Architecture `[Design]`

### 2.1 Layer Mapping

Package structure follows Clean Architecture (see Section 1.1 for diagram):

| Layer | Package | Responsibility |
|-------|---------|----------------|
| Presentation | apps/cli | CLI commands, argument parsing, output formatting |
| Application | packages/core | SessionRunner, orchestration logic |
| Domain | packages/core | Types, interfaces, business rules |
| Infrastructure | packages/agent | ClaudeAgentClient, SDK converters |

### 2.2 Dependency Rule

- `packages/core` has NO external dependencies (pure domain + application)
- `packages/agent` depends on `@autonoe/core` for types only
- `apps/cli` creates infrastructure and injects into application layer

### 2.3 Domain Model

See [Domain Model](docs/domain-model.md) for detailed type definitions.

**Core Types:**

| Category | Types |
|----------|-------|
| Stream Events | StreamEvent (Text, Thinking, ToolInvocation, ToolResponse, End, Error) |
| Value Objects | McpServer, DeliverableInput, OperationResult |
| Entities | Deliverable (with state machine: pending → passed/blocked) |
| Aggregates | DeliverableStatus (persisted to `.autonoe/status.json`) |
| Enums | SessionOutcome, PermissionLevel |
| Type Aliases | MessageStream |

**Key Behaviors:**

- StreamEvent is a discriminated union processed by Session
- Deliverable uses single `status` field (pending/passed/blocked) to eliminate invalid states
- DeliverableStatusReader used by SessionRunner for termination decisions

**Type Definitions:** `packages/core/src/types.ts`

---

## 3. Core Interfaces `[Design]`

Core interface definitions. For detailed specifications, see [Interfaces](docs/interfaces.md).

### 3.1 Interface Summary

| Interface | Purpose | Key Methods |
|-----------|---------|-------------|
| AgentClient | Agent communication | query(), dispose() |
| AgentClientFactory | Create AgentClient instances | create() |
| Session | Execute agent queries | run() |
| SessionRunner | Session loop orchestration | run() |
| BashSecurity | Bash command validation | isCommandAllowed() |
| Logger | Logging output | info(), debug(), warn(), error() |
| PreToolUseHook | Tool call interception | callback() |

### 3.2 Autonoe Tool

Autonoe Tool is a set of deliverable management tools exposed as an MCP Server to the Coding Agent. Each session receives a fresh MCP Server instance with tools appropriate for its instruction type.

| Tool | Purpose |
|------|---------|
| create | Create deliverables with acceptance criteria |
| set_status | Update status: pending, passed, or blocked |
| deprecate | Mark deliverable as deprecated (sync command only) |
| verify | Mark deliverable as verified (sync command only) |
| list | List deliverables with filtering. Filters: `status` (pending/passed/blocked), `verified` (true/false, verify mode only). Optional `limit` (default: 5) |

**Tool Availability per Instruction:**

| Instruction | Available Tools |
|-------------|-----------------|
| initializer | `create` |
| coding | `set_status`, `list` |
| sync | `create`, `deprecate`, `list` |
| verify | `set_status`, `verify`, `list` |

Each session receives only the tools needed for its instruction type.
AgentClientFactory creates a fresh MCP server with the appropriate tool set per session.

For detailed tool specifications, see [Interfaces - Autonoe Tool](docs/interfaces.md#autonoe-tool).

### 3.3 Dependency Injection

| Component              | Injected Via              | Purpose                         |
| ---------------------- | ------------------------- | ------------------------------- |
| AgentClient            | SessionRunner.run()       | Enable testing with mocks       |
| BashSecurity           | PreToolUse hook           | Validate bash commands          |
| Autonoe Tool           | MCP Server per session    | Deliverable management          |
| Logger                 | SessionRunner.run()       | Enable output capture           |

```text
SessionRunner(options) ──▶ run(client, logger) ──▶ Session.run() ──▶ client.query()
              │                    │                    │
         Configuration        Dependency          Per-session
```

### 3.4 Termination Conditions

**Shared Conditions (all commands):**

| Priority | Condition                | Check                                         | Result                            |
| -------- | ------------------------ | --------------------------------------------- | --------------------------------- |
| 1        | User interrupt           | SIGINT received                               | success=false, interrupted=true   |
| 2        | Quota exceeded (no wait) | outcome === 'quota_exceeded' && !waitForQuota | success=false, quotaExceeded=true |
| 5        | Max iterations reached   | iteration >= maxIterations                    | success=false                     |
| 6        | Max retries exceeded     | consecutiveErrors > maxRetries                | success=false, error=message      |

**run Command Conditions:**

| Priority | Condition             | Check                                         | Result                      |
| -------- | --------------------- | --------------------------------------------- | --------------------------- |
| 3        | All achievable passed | All non-blocked deliverables have passed=true | all_passed (goal achieved)  |
| 4        | All blocked           | All deliverables have blocked=true            | all_blocked (cannot proceed)|

**sync Command Conditions:**

| Priority | Condition    | Check                               | Result                       |
| -------- | ------------ | ----------------------------------- | ---------------------------- |
| 3        | All verified | verificationTracker.allVerified()   | all_verified (goal achieved) |

**Verification Tracking (sync command only):**

The sync command uses an in-memory verification tracker to ensure all deliverables are checked:

| Concept    | Description                                           |
| ---------- | ----------------------------------------------------- |
| verified   | Coding Agent has confirmed this deliverable's status  |
| unverified | Coding Agent has not yet checked this deliverable     |

**Initialization:**
- Tracker is initialized **after session 1 (`sync` instruction) completes**
- Populated with all active deliverable IDs from the updated status.json
- Session 1 does NOT check termination conditions (always proceeds to session 2)

**Termination:**
- Each deliverable must be explicitly marked via `verify` tool
- Termination occurs when all deliverables are verified
- Unlike run command, sync does NOT terminate on all_passed/all_blocked

**Blocked Deliverable Rules:**
- A deliverable can only be blocked when `passed=false` (mutual exclusion)
- Blocked means external constraints prevent completion (missing API keys, unavailable services, hardware, network)
- When all non-blocked deliverables pass, the session succeeds even if some are blocked
- When all deliverables are blocked, the session fails
- Reasons for blocking should be documented in `.autonoe-note.md`

**Deprecated Deliverable Rules:**
- Deliverables with `deprecatedAt` are excluded from termination evaluation
- Only applies to `sync` command results
- `run` command does not create deprecated deliverables

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

**Quota Wait Progress Feedback:**

When `--wait-for-quota` is enabled and waiting for quota reset, the system provides periodic progress feedback.

| Component | Description |
|-----------|-------------|
| WaitProgressReporter | Interface for progress reporting during wait |
| Update interval | 60 seconds |
| Display mode | Single-line overwrite (carriage return) |

Output format:
```text
Quota exceeded, waiting 2h 45m 30s until reset...
Quota resets at: 6:00 PM UTC
⏳ Waiting... 2h 44m remaining
```

The progress line is updated every 60 seconds using recursive `setTimeout`, overwriting the previous line to keep terminal output clean.

WaitProgressReporter interface:

| Method | Signature | Description |
|--------|-----------|-------------|
| startWait | `(totalMs: number, resetTime?: Date) => () => void` | Start progress reporting, returns cleanup function |

Dependency injection follows existing pattern:

| Component | Injected Via | Purpose |
|-----------|--------------|---------|
| WaitProgressReporter | SessionRunnerOptions | Enable progress testing with mocks |

Default implementation: `silentWaitProgressReporter` (no output, for testing)

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

## 4. Browser Automation `[Design]`

Autonoe supports Browser Automation for verifying UI behavior and executing E2E tests.

**Design Decisions:**
- Browser Automation is recommended for verification
- Playwright MCP is pre-installed as the default tool
- Users can configure alternative Browser Automation tools via `agent.json` `mcpServers`

### 4.1 Pre-installed Tool: Playwright MCP

Uses Microsoft Playwright MCP server (`@playwright/mcp@latest`) with session isolation:

| Flag | Purpose |
|------|---------|
| `--headless` | Run browser without GUI for CI/server environments |
| `--isolated` | Ensure browser instance isolation per session |

- Server: https://github.com/microsoft/playwright-mcp
- Tool prefix: `mcp__playwright__*`
- Allowed tools defined in `PLAYWRIGHT_MCP_TOOLS` constant (`packages/core/src/configuration.ts`)

#### 4.1.1 Browser Installation

| Platform     | Sandbox  | Browser Source      | Status        |
|--------------|----------|---------------------|---------------|
| Linux x64    | Enabled  | MCP browser_install | Supported     |
| Linux ARM64  | Enabled  | MCP browser_install | Not supported |
| Linux ARM64  | Disabled | npx playwright      | Supported     |
| Docker       | Disabled | npx playwright      | Recommended   |

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

```text
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

```text
navigate ──▶ snapshot ──▶ interact ──▶ wait_for ──▶ verify_*
```

---

## 5. State Management `[Design]`

### 5.1 Directory Structure

```text
project/
├── .autonoe/
│   └── status.json
└── .autonoe-note.md
```

### 5.2 Status Tracking (.autonoe/status.json)

**Deliverable ID Format:**

| Element | Specification |
|---------|---------------|
| Pattern | `{TYPE}-{NNN}` (e.g., UI-001, BE-042, API-003) |
| Type Prefix | Coding Agent-defined based on deliverable category (UI, BE, FE, API, UX, STYLE, etc.) |
| Generation | Coding Agent creates ID when calling `create` tool |
| Uniqueness | Unique within status.json |
| Immutability | ID never changes after creation |

```json
{
  "createdAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD",
  "deliverables": [
    {
      "id": "UI-001",
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

**Deprecated Deliverables:**

When a deliverable is removed from SPEC.md, it is not deleted but marked with `deprecatedAt`:

```json
{
  "id": "DL-002",
  "description": "Legacy Feature",
  "acceptanceCriteria": ["..."],
  "passed": true,
  "blocked": false,
  "deprecatedAt": "2025-01-10"
}
```

- `deprecatedAt` field marks features removed from the specification
- Records are retained for tracking and auditing purposes
- Deprecated deliverables are excluded from termination evaluation

### 5.3 State Persistence

| State                | Writer                       | Reader | Description                        |
| -------------------- | ---------------------------- | ------ | ---------------------------------- |
| Project Files        | Coding Agent (Direct)        | Both   | Application source code            |
| .autonoe/status.json | Autonoe Tool                 | Both   | Deliverable tracking               |
| .autonoe-note.md    | Coding Agent (Direct)        | Both   | Session handoff notes (agent-maintained) |
| Git History          | Coding Agent (Direct)        | Both   | Version control history            |

### 5.4 Configuration

**Configuration Sources:**

```text
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
│  ├── allowCommands: { base?, run?, sync? }  # Hook layer (tiered)│
│  ├── allowPkillTargets: [...]  # Hook layer extensions           │
│  ├── permissions.allow: [...]  # SDK layer (Merged with baseline)│
│  ├── allowedTools: [...]       # Merged with baseline            │
│  └── mcpServers: { ... }       # User priority (see below)       │
└─────────────────────────────────────────────────────────────────┘
```

| Setting          | Source            | Layer      | Customizable   |
| ---------------- | ----------------- | ---------- | -------------- |
| sandbox          | Hardcoded         | SDK        | --no-sandbox   |
| profile          | ALL by default    | PreToolUse | Restrict       |
| allowCommands    | (none)            | PreToolUse | User-defined (tiered) |
| allowPkillTargets| (none)            | PreToolUse | User-defined   |
| permissions      | baseline + user   | SDK        | Merge          |
| allowedTools     | baseline + user   | SDK        | Merge          |
| hooks            | baseline + user   | PreToolUse | Merge          |
| mcpServers       | Hardcoded + user  | SDK        | User priority  |

**Command Architecture:**

Commands are organized into Base (read-only, shared) and Command-specific extensions:

```text
Base Commands (read-only, all commands share)
├── Navigation: ls, pwd, cat, head, tail, wc, find, grep
├── Text Processing: tree, sort, diff, date, printf, uniq, cut, tr, tac, jq
├── Git: git
├── Process Query: which, ps, lsof
└── Utility: echo, sleep

Command Extensions
├── run: mkdir, cp, language profiles, user extensions
└── sync: language profiles (no file ops)
```

**Language Profile Commands:**

Language profile commands (node, python, ruby, go) are available in both commands. The only difference is that `sync` excludes file operation commands (mkdir, cp).

**Command × Profile → Commands:**

| Command | Base Commands | Extensions |
|---------|---------------|------------|
| `run`   | All read-only | + mkdir, cp, language profiles, user extensions |
| `sync`  | All read-only | + language profiles (no mkdir, cp) |

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
  "allowCommands": {
    "base": ["make"],
    "run": ["docker", "custom-cli"],
    "sync": ["shellcheck"]
  },
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

| Field             | Type                        | Layer      | Description                             |
| ----------------- | --------------------------- | ---------- | --------------------------------------- |
| profile           | `string \| string[]`        | PreToolUse | Restrict to specific language profiles  |
| allowCommands     | `string[] \| TieredAllowCommands` | PreToolUse | Additional bash commands (see below)    |
| allowPkillTargets | `string[]`                  | PreToolUse | Additional pkill target processes       |
| permissions.allow | `string[]`                  | SDK        | SDK permission rules (e.g., WebFetch)   |
| allowedTools      | `string[]`                  | SDK        | Additional SDK tools to enable          |
| mcpServers        | `Record<string, McpServer>` | SDK        | Additional MCP servers                  |

**allowCommands Structure:**

| Format | run command | sync command |
|--------|-------------|--------------|
| `["cmd"]` (legacy) | ✅ Allowed | ❌ Ignored |
| `{ base: ["cmd"] }` | ✅ Allowed | ✅ Allowed |
| `{ run: ["cmd"] }` | ✅ Allowed | ❌ Ignored |
| `{ sync: ["cmd"] }` | ❌ Ignored | ✅ Allowed |

Legacy `string[]` format is treated as `{ run: [...] }` for backward compatibility.

**SDK Settings Bridge:**

```text
.autonoe/agent.json → loadConfig() → SECURITY_BASELINE + user config → SDK settings

SDK settingSources: ['project'] (hardcoded)
├── CLAUDE.md            # Project root coding conventions
├── .claude/CLAUDE.md    # Project .claude directory conventions
└── .claude/settings.json # Project SDK settings
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

**Scope:**
Environment variable applies to all commands (run, sync).

See Section 6 for security layer architecture.

---

## 6. Security `[Design]`

### 6.1 Security Layers

```text
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

| Control              | Implementation              | Enforcement     |
| -------------------- | --------------------------- | --------------- |
| OS-Level Sandbox     | SandboxSettings.enabled     | SDK (hardcoded) |
| Bash Auto-Allow      | autoAllowBashIfSandboxed    | SDK (hardcoded) |
| Filesystem Scope     | permissions: ["./**"]       | SDK             |
| Bash Allowlist       | BashSecurity hook           | PreToolUse      |
| .autonoe/ Protection | PreToolUse hook             | PreToolUse      |

### 6.2 Base Security

Base security capabilities shared by all execution modes:

| Category            | Capability | Scope                    |
| ------------------- | ---------- | ------------------------ |
| File Read           | YES        | All files                |
| Git                 | YES        | Full access              |
| Autonoe Tool        | YES        | Deliverable management   |
| Bash                | LIMITED    | Read-only commands only  |
| .autonoe/ Write     | NO         | Block direct writes      |

**Base Bash Commands (Read-only):**

| Category | Commands |
|----------|----------|
| Navigation | ls, pwd, cat, head, tail, wc, find, grep |
| Text Processing | tree, sort, diff, date, printf, uniq, cut, tr, tac, jq |
| Git | git |
| Process Query | which, ps, lsof |
| Utility | echo, sleep |

See [Security Details - Base Security](docs/security.md#base-security) for validation flow and command chain handling.

### 6.3 Run Command Security

Run mode extends Base Security with additional capabilities for implementation:

| Addition         | Description                          |
| ---------------- | ------------------------------------ |
| File Write       | Full project access                  |
| Playwright       | Browser automation via MCP           |
| Profile Commands | Development layer (full toolchain)   |
| User Extensions  | Custom commands via agent.json       |
| Runtime Options  | --allow-destructive, --no-sandbox    |

**Profile Selection:**

| agent.json profile   | Active Profiles                        |
| -------------------- | -------------------------------------- |
| (not set)            | ALL (base + node + python + ruby + go) |
| `"node"`             | base + node                            |
| `"python"`           | base + python                          |
| `["node", "python"]` | base + node + python                   |

**Run Command:** Includes all language profile commands plus file operation commands (mkdir, cp).

See [Security Details - Run Command](docs/security.md#run-command-security) for command allowlists and runtime options.

### 6.4 Sync Command Security

Sync mode restricts Run Command capabilities for verification-only operations:

| Capability       | Run Command        | Sync Command                   |
| ---------------- | ------------------ | ------------------------------ |
| File Write       | Full project       | .autonoe-note.md only          |
| Bash             | Profile + File ops | Profile commands only          |
| Browser Automation | Enabled          | Enabled                        |

**Sync Command = Base Commands + Language Profiles (no file ops):**

| Profile | Commands |
|---------|----------|
| base    | All read-only commands (see Section 6.2) |
| node    | All Node.js commands (npm, npx, node, vitest, jest, eslint, prettier, etc.) |
| python  | All Python commands (pip, python, pytest, mypy, ruff, etc.) |
| ruby    | All Ruby commands (bundle, ruby, rspec, rubocop, etc.) |
| go      | All Go commands (go, gofmt, golangci-lint, etc.) |

**Restrictions:**
- File operation commands (mkdir, cp) are excluded
- User extensions: only `allowCommands.sync` and `allowCommands.base` apply
- Destructive commands (rm, mv) are always disabled

See [Security Details - Sync Command](docs/security.md#sync-command-security) for detailed restrictions.

---

## 7. Build & Distribution `[Design]`

**Package Overview:**

| Package | Description |
|---------|-------------|
| root | Manages npm dependencies; child packages use `*` to inherit versions |
| @autonoe/core | Domain types and application logic (NO external dependencies) |
| @autonoe/agent | Wraps SDK, implements `AgentClient` interface from core |
| @autonoe/cli | Creates `ClaudeAgentClient`, injects into `SessionRunner` |

Package configurations are defined in their respective `package.json` files.

### 7.1 Docker & CI/CD

See [Docker Configuration](docs/docker.md) for detailed build configuration.

**Distribution:**

| Target | Tag | Use Case |
|--------|-----|----------|
| base | `:latest`, `:base` | Minimal runtime |
| node | `:node` | Frontend development |
| python | `:python` | Backend / Data science |
| golang | `:golang` | System programming |
| ruby | `:ruby` | Web development |

**Release Tools:**

| Tool | Purpose |
|------|---------|
| Release Please | Version management, CHANGELOG |
| Bun cross-compile | Multi-platform binary distribution |
| docker/build-push-action | Multi-platform Docker images |

---

## 8. CLI `[Design]`

### 8.1 Common Options

All commands share the following options:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--project-dir` | `-p` | Project directory | cwd |
| `--max-iterations` | `-n` | Maximum coding sessions | - |
| `--max-retries` | - | Maximum retries on session error | 3 |
| `--model` | `-m` | Claude model to use | - |
| `--debug` | `-d` | Show debug output | false |
| `--wait-for-quota` | - | Wait for quota reset instead of exiting | false |
| `--thinking` | - | Enable extended thinking mode (budget tokens) | 8192 |

**Option Validation:**

| Option | Constraint | Error |
|--------|------------|-------|
| `--thinking` | Must be >= 1024 | `Thinking budget must be at least 1024 tokens, got {value}` |
| `--max-iterations` | Must be > 0 if specified | `Max iterations must be positive, got {value}` |
| `--max-retries` | Must be >= 0 | `Max retries must be non-negative, got {value}` |

When validation fails, the command exits immediately with a non-zero exit code.

### 8.1.1 Prerequisites

All commands require the following conditions:

| Condition | Check | Error |
|-----------|-------|-------|
| SPEC.md exists | File exists in project directory | `SPEC.md not found in {projectDir}` |

**Exit Behavior:**

When a prerequisite is not met, the command exits immediately with a non-zero exit code and displays the error message to stderr.

### 8.2 run Command

#### 8.2.1 Usage

```bash
autonoe run [options]
```

In addition to Common Options, the following options are available:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--no-sandbox` | - | Disable SDK sandbox | false |
| `--allow-destructive` | `-D` | Enable rm/mv with path validation | false |

#### 8.2.2 Behavior

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

### 8.3 sync Command

#### 8.3.1 Usage

```bash
autonoe sync [options]
```

Uses Common Options only. No additional options.

#### 8.3.2 Behavior

- Reads SPEC.md and uses Coding Agent to parse deliverables
- Creates or updates `.autonoe/status.json`
- Uses `verify` instruction to validate existing code against deliverables
- **Read-only for source code: Coding Agent does not modify project source files, but may commit status changes via git**

**Status Sync Strategy:**

| Condition | Action |
|-----------|--------|
| status.json not exists | Create new file, all deliverables as pending |
| New deliverable in SPEC | Add to status.json with pending status |
| Removed deliverable from SPEC | Mark `deprecatedAt` date, retain record |
| Verified as passed | Coding Agent validates code and marks passed=true |

#### 8.3.3 Execution Flow

```text
SPEC.md ──► `sync` instruction ──► Create/Update status.json
                                              │
                                              ▼
                                  `verify` instruction ──► Validate & Mark passed
```

**Session Structure (Single SessionRunner Loop):**

The sync command uses a single SessionRunner loop with dynamic instruction selection:

| Session | Instruction | Purpose |
|---------|-------------|---------|
| 1 | sync | Parse SPEC.md, create/update deliverables |
| 2+ | verify | Validate implementation, mark verified |

**Termination:**
- After session 1 completes, verification tracker is initialized with all active deliverable IDs from status.json
- Loop continues until all deliverables are **verified** (checked), or max iterations reached
- Unlike `run` command, sync terminates on `all_verified`, not `all_passed`

---

## 9. Decision Table `[Consistency]`

### 9.1 Session Loop Behavior

| .autonoe/status.json | --max-iterations | Action                                  |
| -------------------- | ---------------- | --------------------------------------- |
| NOT EXISTS           | any              | Use `initializer` instruction, continue |
| EXISTS (none passed) | any              | Run all deliverables                    |
| EXISTS (partial)     | any              | Run deliverables with passed=false      |
| EXISTS (all passed)  | any              | Exit loop, success                      |
| any                  | reached limit    | Exit loop, partial                      |
| any                  | undefined        | Continue until all pass                 |

See [Appendix A](#appendix-a-instructions-design) for instruction selection rules.

### 9.2 Coding Agent Tool Availability

Tool availability by command. For detailed restrictions, see [Section 6](#6-security-design).

| Tool Category      | run                         | sync                        |
| ------------------ | --------------------------- | --------------------------- |
| File Read          | YES                         | YES                         |
| File Write         | YES                         | LIMITED (.autonoe-note.md)  |
| File Edit          | YES                         | LIMITED (.autonoe-note.md)  |
| Bash               | Profile commands + File ops | Profile commands only       |
| Git                | YES                         | YES                         |
| Browser Automation | YES                         | YES                         |
| Autonoe Tool       | YES                         | YES                         |

### 9.3 Configuration Merge

| User Config (agent.json)    | Autonoe Behavior                            |
| --------------------------- | ------------------------------------------- |
| Custom permissions          | Merge with security baseline                |
| Custom hooks                | Merge with security baseline                |
| Custom mcpServers           | User priority (see Section 5.4)             |
| Custom allowCommands        | Merge with profile commands                 |
| Disable sandbox             | Allowed with warning (stderr)               |
| Remove .autonoe/ protection | Re-apply security baseline                  |

### 9.4 Profile Selection

| agent.json profile     | Active Profiles                        | Use Case                |
| ---------------------- | -------------------------------------- | ----------------------- |
| (not set)              | ALL (base + node + python + ruby + go) | Default, all languages  |
| `"node"`               | base + node                            | Node.js only            |
| `"python"`             | base + python                          | Python only             |
| `"ruby"`               | base + ruby                            | Ruby only               |
| `"go"`                 | base + go                              | Go only                 |
| `["node", "python"]`   | base + node + python                   | Specific combination    |

**Profile × Command:**

| Command | Language Commands | File Operations |
|---------|-------------------|-----------------|
| `run`   | All               | mkdir, cp       |
| `sync`  | All               | (excluded)      |

### 9.5 Sync Command Behavior

| status.json      | SPEC.md Deliverable | Action                              |
|------------------|---------------------|-------------------------------------|
| NOT EXISTS       | any                 | Create new with all deliverables    |
| EXISTS           | new deliverable     | Add with pending status             |
| EXISTS           | removed deliverable | Mark deprecatedAt, retain record    |
| EXISTS           | existing match      | Verify and update passed status     |

### 9.6 Deprecated Deliverable Handling

| Deliverable State | deprecatedAt | Termination Evaluation |
|-------------------|--------------|------------------------|
| passed=true       | not set      | Included               |
| passed=false      | not set      | Included               |
| any               | set (dated)  | Excluded               |

### 9.7 Termination by Command

| Command | Goal                      | Termination Triggers                                    |
| ------- | ------------------------- | ------------------------------------------------------- |
| run     | All deliverables passed   | all_passed (goal achieved), all_blocked (cannot proceed)|
| sync    | All deliverables verified | all_verified (goal achieved)                            |

**Design Principle**: Commands continue running until "goal achieved" or "cannot proceed".

- **run**: Goal is to pass all deliverables. Stopping on all_blocked means implementation cannot continue, not failure.
- **sync**: Goal is to confirm status of all deliverables. all_verified indicates verification complete.

### 9.8 Verification Result (Sync Command)

| All Verified | Deliverable Statuses      | Result Description                    |
| ------------ | ------------------------- | ------------------------------------- |
| NO           | any                       | Continue verification                 |
| YES          | all passed                | Verification complete, all passed     |
| YES          | some passed, some pending | Verification complete, partial impl   |
| YES          | some blocked              | Verification complete, some blocked   |
| YES          | all blocked               | Verification complete, all blocked    |

### 9.9 Session Runner Output Format

| Command | Overall Message Format |
|---------|------------------------|
| run     | `Overall: X session(s), Y/Z deliverables passed, cost=$..., duration=...` |
| sync    | `Overall: X session(s), Y/Z verified, cost=$..., duration=...` |

**Termination Messages:**

| ExitReason | Command | Message |
|------------|---------|---------|
| all_passed | run | `All achievable deliverables passed` |
| all_verified | sync | `All X deliverables verified` |
| all_blocked | both | `All X deliverables are blocked` |
| max_iterations | both | `Max iterations (N) reached` |
| quota_exceeded | both | `Quota exceeded` |
| interrupted | both | `User interrupted` |

---

## Appendix A: Instructions `[Design]`

### A.1 Instruction Selection

| Instruction   | Condition                                     |
| ------------- | --------------------------------------------- |
| initializer   | `run` command, no .autonoe/status.json        |
| coding        | `run` command, .autonoe/status.json exists    |
| sync          | `sync` command, session 1                     |
| verify        | `sync` command, session 2+                    |

### A.2 Instruction Override

| Override File           | Fallback               | Purpose                    |
| ----------------------- | ---------------------- | -------------------------- |
| .autonoe/initializer.md | Built-in instruction   | Custom initialization flow |
| .autonoe/coding.md      | Built-in instruction   | Custom implementation flow |
| .autonoe/sync.md        | Built-in instruction   | Custom spec parsing flow   |
| .autonoe/verify.md      | Built-in instruction   | Custom verification flow   |

### A.3 InstructionResolver Interface

**InstructionName** - Available instruction types: `'initializer'` | `'coding'` | `'sync'` | `'verify'`

| Method | Signature | Description |
|--------|-----------|-------------|
| resolve | `(name: InstructionName) => Promise<string>` | Resolve instruction by name |

