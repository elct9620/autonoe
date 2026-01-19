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
- [4. State Management](#4-state-management-design)
- [5. Security](#5-security-design)
  - [Security Details](docs/security.md)
- [6. Build & Distribution](#6-build--distribution-design)
  - [Docker Configuration](docs/docker.md)
- [7. CLI](#7-cli-design)
- [Appendix A: Instructions](#appendix-a-instructions-design)

### Consistency Layer
- [8. Decision Table](#8-decision-table-consistency)
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

### 0.6 Glossary

| Term | Definition |
|------|------------|
| Coding Agent | The autonomous Claude instance controlled by Autonoe that implements deliverables |
| Agent SDK | The @anthropic-ai/claude-agent-sdk package that provides the underlying agent infrastructure |
| AgentClient | Internal interface for agent communication (query/dispose) |
| Autonoe Tool | MCP Server exposing deliverable management tools to the Coding Agent |
| Session | A single agent query execution cycle |
| Deliverable | A verifiable work unit with acceptance criteria |
| Instruction | Prompt template that guides Coding Agent behavior (initializer, coding, sync, verify) |
| Workflow | Domain model encapsulating the instruction pair for each command (run, sync) |

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
│  │  │                      Built-in Tools                              │││
│  │  │  ┌─────────────────────────┐  ┌───────────────────────────────┐ │││
│  │  │  │    Bash                 │  │   File System (Read/Write)    │ │││
│  │  │  └─────────────────────────┘  └───────────────────────────────┘ │││
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

| Tool        | Source       | Purpose                   |
| ----------- | ------------ | ------------------------- |
| File System | SDK Built-in | Read/Write project files  |
| Bash        | SDK Built-in | Execute allowed commands  |
| Skill       | SDK Built-in | Invoke Claude Code skills |

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
| deprecate | Mark deliverable as deprecated (`sync` command only) |
| verify | Mark deliverable as verified (`sync` command only) |
| list | List deliverables with optional filtering by status or verified state |

**Tool Availability per Instruction:**

| Workflow | Phase | Instruction | Available Tools |
|----------|-------|-------------|-----------------|
| run | planning | initializer | `create` |
| run | implementation | coding | `set_status`, `list` |
| sync | planning | sync | `create`, `deprecate`, `list` |
| sync | implementation | verify | `set_status`, `verify`, `list` |

Each session receives only the tools needed for its instruction type.
AgentClientFactory creates a fresh MCP server with the appropriate tool set per session.
See [Appendix A.4](#a4-workflow) for workflow definitions.

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

**`run` Command Conditions:**

| Priority | Condition             | Check                                         | Result                      |
| -------- | --------------------- | --------------------------------------------- | --------------------------- |
| 3        | All achievable passed | All non-blocked deliverables have passed=true | all_passed (goal achieved)  |
| 4        | All blocked           | All deliverables have blocked=true            | all_blocked (cannot proceed)|

**`sync` Command Conditions:**

| Priority | Condition    | Check                               | Result                       |
| -------- | ------------ | ----------------------------------- | ---------------------------- |
| 3        | All verified | verificationTracker.allVerified()   | all_verified (goal achieved) |

**Verification Tracking (`sync` command only):**

The `sync` command uses an in-memory verification tracker to ensure all deliverables are checked:

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
- Unlike `run` command, `sync` does NOT terminate on all_passed/all_blocked

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

When `--wait-for-quota` is enabled and waiting for quota reset, the system provides progress feedback via the Presenter (see Section 3.5).

Quota waiting displays progress with `remainingMs` and `resetTime`:

```text
⏳ Waiting... 2h 44m remaining (resets at 6:00 PM UTC)
```

The progress line is updated using the same single-line overwrite mechanism as other activity displays.

**Interrupt During Quota Wait:**

When waiting for quota reset, user interrupt (SIGINT/Ctrl+C) is handled immediately:
- The delay is cancelled via AbortSignal
- The system terminates with `interrupted` exit reason
- No waiting until the reset period completes

This ensures the highest priority of user interrupt (Priority 1) is maintained even during long quota wait periods.

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

### 3.5 Console Output

Defines how CLI presents information to users. All output coordination is handled in the Presentation layer (apps/cli).

**Output Types:**

| Type | Persistence | Behavior |
|------|-------------|----------|
| Log | Permanent | Once printed, stays in terminal history |
| Activity | Transient | Single-line, can be overwritten, always at bottom |

**Startup Display:**

```text
Autonoe v{VERSION}

{startupMessage}
  Working directory: {projectDir}
  Max iterations: {maxIterations}      # if specified
  Plan model: {planModel}              # always shown, default: opus
  Model: {model}                       # always shown, default: sonnet
  Thinking: {tokens} tokens            # if specified
```

| Field | Source | Display Condition |
|-------|--------|-------------------|
| VERSION | Package version | Always |
| startupMessage | Command-specific | Always |
| projectDir | Validated option | Always |
| maxIterations | CLI option | If specified |
| planModel | CLI option or default | Always (default: opus) |
| model | CLI option or default | Always (default: sonnet) |
| tokens | Thinking budget | If --thinking specified |

**Presenter Interface (CLI layer):**

| Method | Signature | Description |
|--------|-----------|-------------|
| log | `(level: LogLevel, message: string) => void` | Output permanent log message |
| activity | `(event: StreamEvent) => void` | Update transient activity line |
| clearActivity | `() => void` | Clear activity line (session end) |

**StreamEvent to Activity Display:**

| StreamEvent Type | Display Content |
|-----------------|-----------------|
| stream_thinking | "Thinking..." |
| stream_tool_invocation | "Running {toolName}..." |
| stream_tool_response | (Updates tool count) |
| stream_text | "Responding..." |
| stream_end | clearActivity() |
| stream_error | (No change) |

**Output Coordination:**

The Presenter ensures Log and Activity outputs don't conflict:

```text
log(message):
  1. if hasActivityLine: clearActivityLine()
  2. console.log(message)
  3. if hasActivityLine: redrawActivityLine()

activity(event):
  1. updateState(event)
  2. renderActivityLine()  // \r\x1b[K + content (no newline)
  3. hasActivityLine = true

clearActivity():
  1. if hasActivityLine: clearActivityLine()
  2. hasActivityLine = false
```

**Display Format:**

```text
⚡ [elapsed] [activity] [tool count]
```

**Elapsed Time Format:** Uses `formatDuration()` from `packages/core/src/duration.ts`:
- Zero-value parts are omitted (e.g., `1h`, `1m 30s`, `5s`)
- Examples: `5s`, `1m 30s`, `1h`, `1h 1m 1s`

Examples:
```text
⚡ 5s Thinking...
⚡ 12s Running bash... (1 tool)
⚡ 45s Running Read... (3 tools)
⚡ 1m 23s Responding... (7 tools)
⚡ 1h 5m Responding... (42 tools)
```

**Waiting Display:**
```text
⏳ Waiting... 2h 44m remaining (resets at 6:00 PM UTC)
```

**Update Behavior:**

| Parameter | Value |
|-----------|-------|
| Update interval | 1 second (default) |
| Activity display | Single-line overwrite (`\r\x1b[K`) |
| Log display | Multi-line accumulation |

**Comparison with Debug Mode:**

| Aspect | Debug Mode | Normal Mode |
|--------|------------|-------------|
| Information level | Full event details | Summary only |
| Output style | All via log() | log() + activity() |
| Event content | Shows payload data | Activity type only |
| Tool details | Full input/output | Tool name only |
| Thinking | Content (truncated) | Just "Thinking..." |

**Core Layer Integration:**

SessionRunner receives a `StreamEventCallback` for activity reporting:

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| StreamEventCallback | Core (interface) | Receive StreamEvent from Session |
| Presenter | CLI | Convert StreamEvent to display, coordinate output |

For detailed specifications, see [Interfaces - Presenter](docs/interfaces.md#presenter).

---

## 4. State Management `[Design]`

### 4.1 Directory Structure

```text
project/
├── .autonoe/
│   └── status.json
└── .autonoe-note.md
```

### 4.2 Status Tracking (.autonoe/status.json)

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

### 4.3 State Persistence

| State                | Writer                       | Reader | Description                        |
| -------------------- | ---------------------------- | ------ | ---------------------------------- |
| Project Files        | Coding Agent (Direct)        | Both   | Application source code            |
| .autonoe/status.json | Autonoe Tool                 | Both   | Deliverable tracking               |
| `.autonoe-note.md`    | Coding Agent (Direct)        | Both   | Session handoff notes (agent-maintained) |
| Git History          | Coding Agent (Direct)        | Both   | Version control history            |

### 4.4 Configuration

**Configuration Sources:**

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Sources                         │
├─────────────────────────────────────────────────────────────────┤
│  Hardcoded (packages/core)                                       │
│  └── sandbox: { enabled: true }                                  │
│                                                                  │
│  Security Baseline (packages/core, always enforced)              │
│  ├── permissions.allow: [Read(./**), Write(./**), Read(/tmp/**), Write(/tmp/**), ...]│
│  ├── allowedTools: [Read, Write, Edit, Skill, ...]              │
│  └── hooks: [BashSecurity, .autonoe Protection]                  │
│                                                                  │
│  Language Profiles                                               │
│  └── node, bun, python, ruby, go, rust, php                      │
│                                                                  │
│  User Config (.autonoe/agent.json)                               │
│  ├── profile: "node" | ["node", "python"]  # Language profiles   │
│  ├── allowCommands: { base?, run?, sync? }  # Hook layer (tiered)│
│  ├── allowPkillTargets: [...]  # Hook layer extensions           │
│  ├── permissions.allow: [...]  # SDK layer (Merged with baseline)│
│  ├── allowedTools: [...]       # Merged with baseline            │
│  └── mcpServers: { ... }       # User-defined MCP servers        │
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
| mcpServers       | (none)            | SDK        | User-defined   |

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

Language profile commands (node, bun, python, ruby, go, rust, php) are available in both commands. The only difference is that `sync` excludes file operation commands (mkdir, cp).

**Command × Profile → Commands:**

| Command | Base Commands | Extensions |
|---------|---------------|------------|
| `run`   | All read-only | + mkdir, cp, language profiles, user extensions |
| `sync`  | All read-only | + language profiles (no mkdir, cp) |

**MCP Servers Configuration:**

| agent.json mcpServers | Result                          |
| --------------------- | ------------------------------- |
| (undefined)           | No MCP servers                  |
| `{ "custom": {} }`    | User-defined servers loaded     |

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

| Format | `run` command | `sync` command |
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

### 4.5 SDK Sandbox Configuration

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

See Section 5 for security layer architecture.

---

## 5. Security `[Design]`

### 5.1 Security Layers

```text
┌─────────────────────────────────────────────────────┐
│              Autonoe Security Layers                │
├─────────────────────────────────────────────────────┤
│  Layer 1: SDK Sandbox (enabled: true)               │
│  ├── OS-level process isolation                     │
│  └── Filesystem/network containment                 │
├─────────────────────────────────────────────────────┤
│  Layer 2: Filesystem Scope (SDK permissions)        │
│  └── Read/Write: project directory + /tmp           │
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

### 5.2 Base Security

Base security capabilities shared by all execution modes:

| Category            | Capability | Scope                    |
| ------------------- | ---------- | ------------------------ |
| File Read           | YES        | All files                |
| Git                 | YES        | Full access              |
| Autonoe Tool        | YES        | Deliverable management   |
| Temp Directory      | YES        | /tmp/** (read/write)     |
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

### 5.3 Run Command Security

`run` mode extends Base Security with additional capabilities for implementation:

| Addition         | Description                          |
| ---------------- | ------------------------------------ |
| File Write       | Full project access                  |
| Profile Commands | Development layer (full toolchain)   |
| User Extensions  | Custom commands via agent.json       |
| Runtime Options  | --allow-destructive, --no-sandbox    |

**Profile Selection:**

| agent.json profile   | Active Profiles                                            |
| -------------------- | ---------------------------------------------------------- |
| (not set)            | ALL (base + node + bun + python + ruby + go + rust + php)  |
| `"node"`             | base + node                                                |
| `"bun"`              | base + bun                                                 |
| `"python"`           | base + python                                              |
| `["node", "python"]` | base + node + python                                       |

**`run` Command:** Includes all language profile commands plus file operation commands (mkdir, cp).

See [Security Details - Run Command](docs/security.md#run-command-security) for command allowlists and runtime options.

### 5.4 Sync Command Security

`sync` mode restricts `run` command capabilities for verification-only operations:

| Capability       | `run` Command      | `sync` Command                 |
| ---------------- | ------------------ | ------------------------------ |
| File Write       | Full project       | `.autonoe-note.md` only          |
| Bash             | Profile + File ops | Profile commands only          |

**`sync` Command = Base Commands + Language Profiles (no file ops):**

| Profile | Commands |
|---------|----------|
| base    | All read-only commands (see Section 5.2) |
| node    | All Node.js commands (npm, npx, node, vitest, jest, eslint, prettier, etc.) |
| bun     | All Bun commands (bun, bunx) |
| python  | All Python commands (pip, python, pytest, mypy, ruff, etc.) |
| ruby    | All Ruby commands (bundle, ruby, rspec, rubocop, etc.) |
| go      | All Go commands (go, gofmt, golangci-lint, etc.) |
| rust    | All Rust commands (cargo, rustc, rustfmt, clippy, etc.) |
| php     | All PHP commands (php, composer, phpunit, phpstan, etc.) |

**Restrictions:**
- File operation commands (mkdir, cp) are excluded
- User extensions: only `allowCommands.sync` and `allowCommands.base` apply
- Destructive commands (rm, mv) are always disabled

See [Security Details - Sync Command](docs/security.md#sync-command-security) for detailed restrictions.

---

## 6. Build & Distribution `[Design]`

**Package Overview:**

| Package | Description |
|---------|-------------|
| root | Manages npm dependencies; child packages use `*` to inherit versions |
| @autonoe/core | Domain types and application logic (NO external dependencies) |
| @autonoe/agent | Wraps SDK, implements `AgentClient` interface from core |
| @autonoe/cli | Creates `ClaudeAgentClient`, injects into `SessionRunner` |

Package configurations are defined in their respective `package.json` files.

### 6.1 Distribution Formats

| Format | Platform | Use Case |
|--------|----------|----------|
| Binary | Linux, macOS, Windows | Direct execution |
| Docker | Container platforms | Containerized deployment |
| Cloud Image | KVM/QEMU environments | VM deployment |

### 6.2 Docker Images

See [Docker Configuration](docs/docker.md) for detailed build configuration.

**Distribution:**

| Target | Tag | Use Case |
|--------|-----|----------|
| base | `:latest`, `:base` | Minimal runtime |
| node | `:node` | Frontend development |
| bun | `:bun` | Full-stack development |
| python | `:python` | Backend / Data science |
| golang | `:golang` | System programming |
| ruby | `:ruby` | Web development |
| rust | `:rust` | Systems programming |
| php | `:php` | Web development |

### 6.3 Cloud Image

See [Cloud Image Configuration](docs/cloud-image.md) for detailed build configuration.

**Image Specification:**

| Attribute | Value |
|-----------|-------|
| Base Image | Ubuntu 24.04 LTS Cloud Image |
| Format | `.img` (raw disk image) |
| Variant | Base only |
| Target | KVM/QEMU compatible hypervisors |

**Build Tool:**

| Tool | Purpose |
|------|---------|
| libguestfs-tools | Image modification (Ubuntu official package) |
| virt-customize | Inject files and run commands |

**Pre-installed Components:**

| Component | Path |
|-----------|------|
| Autonoe CLI | `/usr/local/bin/autonoe` |
| Git | (system) |
| curl, ca-certificates | (system) |
| openssh-server | (system) |

**Image Naming Convention:**

| Pattern | Example |
|---------|---------|
| `autonoe-ubuntu-{os-version}.img` | `autonoe-ubuntu-24.04.img` |
| `autonoe-{version}-ubuntu-{os-version}.img` | `autonoe-1.0.0-ubuntu-24.04.img` |

**Cloud-Init Support:**

| Feature | Support |
|---------|---------|
| User creation | Yes |
| SSH key injection | Yes |
| Hostname configuration | Yes |
| Network configuration | DHCP default |

**Release Assets:**

| File | Description |
|------|-------------|
| `autonoe-{version}-ubuntu-24.04.img` | Cloud Image |
| `autonoe-{version}-ubuntu-24.04.img.sha256` | Checksum |

### 6.4 Release Tools

| Tool | Purpose |
|------|---------|
| Release Please | Version management, CHANGELOG |
| Bun cross-compile | Multi-platform binary distribution |
| docker/build-push-action | Multi-platform Docker images |
| libguestfs (virt-customize) | Cloud image generation |

---

## 7. CLI `[Design]`

### 7.1 Common Options

All commands share the following options:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--project-dir` | `-p` | Project directory | cwd |
| `--max-iterations` | `-n` | Maximum coding sessions | - |
| `--max-retries` | - | Maximum retries on session error | 3 |
| `--model` | `-m` | Claude model for coding/verify sessions | sonnet |
| `--plan-model` | `-pm` | Claude model for planning sessions (initializer/sync) | opus |
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

### 7.1.1 Model Selection

| Instruction | Model Option | Default |
|-------------|--------------|---------|
| initializer | `--plan-model` | opus |
| sync | `--plan-model` | opus |
| coding | `--model` | sonnet |
| verify | `--model` | sonnet |

### 7.1.2 Prerequisites

All commands require the following conditions:

| Condition | Check | Error |
|-----------|-------|-------|
| SPEC.md exists | File exists in project directory | `SPEC.md not found in {projectDir}` |

**Exit Behavior:**

When a prerequisite is not met, the command exits immediately with a non-zero exit code and displays the error message to stderr.

### 7.2 run Command

#### 7.2.1 Usage

```bash
autonoe run [options]
```

In addition to Common Options, the following options are available:

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--no-sandbox` | - | Disable SDK sandbox | false |
| `--allow-destructive` | `-D` | Enable rm/mv with path validation | false |

#### 7.2.2 Behavior

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

### 7.3 sync Command

#### 7.3.1 Usage

```bash
autonoe sync [options]
```

Uses Common Options only. No additional options.

#### 7.3.2 Behavior

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

#### 7.3.3 Execution Flow

```text
SPEC.md ──► `sync` instruction ──► Create/Update status.json
                                              │
                                              ▼
                                  `verify` instruction ──► Validate & Mark passed
```

**Session Structure (Single SessionRunner Loop):**

The `sync` command uses a single SessionRunner loop with dynamic instruction selection:

| Session | Instruction | Purpose |
|---------|-------------|---------|
| 1 | sync | Parse SPEC.md, create/update deliverables |
| 2+ | verify | Validate implementation, mark verified |

**Termination:**
- After session 1 completes, verification tracker is initialized with all active deliverable IDs from status.json
- Loop continues until all deliverables are **verified** (checked), or max iterations reached
- Unlike `run` command, `sync` terminates on `all_verified`, not `all_passed`

---

## 8. Decision Table `[Consistency]`

### 8.1 Session Loop Behavior

| .autonoe/status.json | --max-iterations | Action                                  |
| -------------------- | ---------------- | --------------------------------------- |
| NOT EXISTS           | any              | Use `initializer` instruction, continue |
| EXISTS (none passed) | any              | Run all deliverables                    |
| EXISTS (partial)     | any              | Run deliverables with passed=false      |
| EXISTS (all passed)  | any              | Exit loop, success                      |
| any                  | reached limit    | Exit loop, partial                      |
| any                  | undefined        | Continue until all pass                 |

See [Appendix A](#appendix-a-instructions-design) for instruction selection rules.

### 8.2 Coding Agent Tool Availability

Tool availability by command. For detailed restrictions, see [Section 5](#5-security-design).

| Tool Category | run                         | sync                          |
| ------------- | --------------------------- | ----------------------------- |
| File Read     | YES                         | YES                           |
| File Write    | YES                         | LIMITED (`.autonoe-note.md`)  |
| File Edit     | YES                         | LIMITED (`.autonoe-note.md`)  |
| Bash          | Profile commands + File ops | Profile commands only         |
| Git           | YES                         | YES                           |
| Skill         | YES                         | YES                           |
| Autonoe Tool  | YES                         | YES                           |

### 8.3 Configuration Merge

| User Config (agent.json)    | Autonoe Behavior                            |
| --------------------------- | ------------------------------------------- |
| Custom permissions          | Merge with security baseline                |
| Custom hooks                | Merge with security baseline                |
| Custom mcpServers           | User-defined (see Section 4.4)              |
| Custom allowCommands        | Merge with profile commands                 |
| Disable sandbox             | Allowed with warning (stderr)               |
| Remove .autonoe/ protection | Re-apply security baseline                  |

### 8.4 Profile Selection

See [Section 5.3](#53-run-command-security) for profile details.

| agent.json profile     | Active Profiles                                           |
| ---------------------- | --------------------------------------------------------- |
| (not set)              | ALL (base + node + bun + python + ruby + go + rust + php) |
| `"node"`               | base + node                                               |
| `"bun"`                | base + bun                                                |
| `["node", "python"]`   | base + node + python                                      |

### 8.5 Sync Command Behavior

| status.json      | SPEC.md Deliverable | Action                              |
|------------------|---------------------|-------------------------------------|
| NOT EXISTS       | any                 | Create new with all deliverables    |
| EXISTS           | new deliverable     | Add with pending status             |
| EXISTS           | removed deliverable | Mark deprecatedAt, retain record    |
| EXISTS           | existing match      | Verify and update passed status     |

### 8.6 Deprecated Deliverable Handling

| Deliverable State | deprecatedAt | Termination Evaluation |
|-------------------|--------------|------------------------|
| passed=true       | not set      | Included               |
| passed=false      | not set      | Included               |
| any               | set (dated)  | Excluded               |

### 8.7 Termination by Command

See [Section 3.4](#34-termination-conditions) for details.

| Command | Goal                      | Termination Triggers        |
| ------- | ------------------------- | --------------------------- |
| run     | All deliverables passed   | all_passed, all_blocked     |
| sync    | All deliverables verified | all_verified                |

### 8.8 Verification Result (Sync Command)

| All Verified | Deliverable Statuses      | Result Description                    |
| ------------ | ------------------------- | ------------------------------------- |
| NO           | any                       | Continue verification                 |
| YES          | all passed                | Verification complete, all passed     |
| YES          | some passed, some pending | Verification complete, partial impl   |
| YES          | some blocked              | Verification complete, some blocked   |
| YES          | all blocked               | Verification complete, all blocked    |

### 8.9 Session Runner Output Format

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

### 8.10 Console Output Behavior

See [Section 3.5](#35-console-output) and [Interfaces - Presenter](docs/interfaces.md#presenter) for details.

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

### A.4 Workflow

Workflow is a Domain Model (Value Object) that encapsulates instruction pairs. Each workflow contains a planning instruction and an implementation instruction.

**WorkflowType** - Available workflow types: `'run'` | `'sync'`

**PhaseType** - Phase classification: `'planning'` | `'implementation'`

**Workflow Class:**

| Property | Type | Description |
|----------|------|-------------|
| type | WorkflowType | Workflow identifier |
| planningInstruction | InstructionName | Planning phase instruction |
| implementationInstruction | InstructionName | Implementation phase instruction |

| Method | Signature | Description |
|--------|-----------|-------------|
| fromType | `(type: WorkflowType) => Workflow` | Get workflow by type |
| isPlanningInstruction | `(instruction: InstructionName) => boolean` | Check if instruction is planning phase |
| getPhaseType | `(instruction: InstructionName) => PhaseType` | Get phase type for instruction |
| selectInstruction | `(isFirstSession: boolean) => InstructionName` | Select instruction based on session position |

**Workflow Definitions:**

| Static Instance | Type | Planning | Implementation |
|-----------------|------|----------|----------------|
| Workflow.run | run | initializer | coding |
| Workflow.sync | sync | sync | verify |

**Model Selection by Phase:**

| Phase | CLI Option | Default Model | Purpose |
|-------|------------|---------------|---------|
| planning | `--plan-model` | opus | Understand problem, parse specification |
| implementation | `--model` | sonnet | Execute solution, verify results |

### A.5 InstructionSelector

InstructionSelector is a strategy interface for dynamically selecting instructions per session.

**InstructionSelectionContext:**

| Property | Type | Description |
|----------|------|-------------|
| iteration | number | Current session iteration (1-based) |
| statusReader | DeliverableStatusReader | Reader for status.json |

**InstructionSelectionResult:**

| Property | Type | Description |
|----------|------|-------------|
| name | InstructionName | Selected instruction name |
| content | string | Resolved instruction content |

**InstructionSelector Interface:**

| Method | Signature | Description |
|--------|-----------|-------------|
| select | `(context: InstructionSelectionContext) => Promise<InstructionSelectionResult>` | Select instruction for session |

**Factory Function:**

| Function | Signature | Description |
|----------|-----------|-------------|
| createInstructionSelector | `(workflow: Workflow, resolver: InstructionResolver, isFirstSession: (ctx) => Promise<boolean>) => InstructionSelector` | Create selector from workflow and predicate |

The factory function reduces boilerplate when the selection logic is "first session vs subsequent". It uses `Workflow.selectInstruction()` internally to determine the instruction name based on the `isFirstSession` predicate result.

