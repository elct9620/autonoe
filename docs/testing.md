# Test Scenarios

This document contains unit test and integration test scenarios for Autonoe. These scenarios are part of the Consistency Layer, ensuring uniform implementation across the codebase.

For the main specification, see [SPEC.md](../SPEC.md).

---

## Unit Test Scenarios `[Consistency]`

### SessionRunner

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
| SC-S011 | All passed, 2 sessions             | Overall log with cost and duration      |
| SC-S012 | Partial with blocked               | Overall log shows "(N blocked)"         |
| SC-S013 | Max iterations reached             | Overall logged before exit              |

SC-S002, SC-S004, SC-S008, SC-S009 validate Decision Table 7.1 behavior.

### TerminationEvaluator

| ID     | Input                                      | Expected Output           |
| ------ | ------------------------------------------ | ------------------------- |
| TE-080 | useSyncTermination + allVerified()=true    | all_verified exit         |
| TE-081 | useSyncTermination + allVerified()=false   | continue                  |
| TE-082 | useSyncTermination + maxIterations reached | all_verified has priority |
| TE-083 | sync session 1 (no tracker yet)            | always continue           |
| TE-084 | sync session 2 + tracker initialized       | check all_verified        |

### Bash Security

| ID      | Input                    | Expected Output                 |
| ------- | ------------------------ | ------------------------------- |
| SC-X001 | Allowed: `npm install`   | Command executed                |
| SC-X002 | Blocked: `rm -rf /`      | Command denied                  |
| SC-X004 | Chained with blocked cmd | Entire command denied           |
| SC-X008 | `chmod +x script.sh`     | Allowed (executable permission) |
| SC-X009 | `chmod 777 file`         | Denied (numeric mode blocked)   |
| SC-X010 | `pkill node`             | Allowed (dev process)           |
| SC-X011 | `pkill postgres`         | Denied (non-dev process)        |
| SC-X012 | `chmod -R +x dir/`       | Denied (-R flag blocked)        |
| SC-X013 | `r\m -rf /`              | Denied (backslash no bypass)    |
| SC-X014 | `echo "test\nvalue"`     | Allowed (escaped in quotes)     |
| SC-X015 | `""`                     | Allowed (empty command)         |
| SC-X016 | Hook with no command     | Approved (continue=true)        |
| SC-X017 | `./bin/dev.sh`           | Allowed (dev script)            |
| SC-X018 | `bin/dev.sh --flag`      | Denied (no args allowed)        |

**Destructive Commands (--allow-destructive):**

| ID      | Input                     | allowDestructive | Expected        |
| ------- | ------------------------- | ---------------- | --------------- |
| SC-X019 | `rm file.txt`             | false            | Denied          |
| SC-X020 | `rm file.txt`             | true             | Allowed         |
| SC-X021 | `rm ../file.txt`          | true             | Denied (escape) |
| SC-X022 | `rm /etc/passwd`          | true             | Denied (escape) |
| SC-X023 | `rm --no-preserve-root /` | true             | Denied (flag)   |
| SC-X024 | `mv src.ts dst.ts`        | true             | Allowed         |
| SC-X025 | `mv src.ts ../dst.ts`     | true             | Denied (escape) |
| SC-X026 | `mv ../src.ts dst.ts`     | true             | Denied (escape) |

### Deliverable Tools (autonoe)

| ID      | Tool       | Input                          | Expected Output                    |
| ------- | ---------- | ------------------------------ | ---------------------------------- |
| DL-T001 | create     | Array with valid deliverables  | All deliverables added             |
| DL-T002 | create     | Array with duplicate ID        | Error: ID already exists           |
| DL-T003 | set_status | Valid ID, status=passed        | passed=true, blocked=false         |
| DL-T004 | set_status | Invalid deliverable ID         | Error: deliverable not found       |
| DL-T005 | set_status | Valid ID, status=blocked       | passed=false, blocked=true         |
| DL-T006 | set_status | Valid ID, status=pending       | passed=false, blocked=false        |
| DL-T007 | set_status | Blocked ID, status=pending     | Reset: blocked=false               |
| DL-T008 | set_status | Valid ID, callback provided    | Callback invoked with notification |
| DL-T009 | set_status | Invalid ID, callback provided  | Callback not invoked               |
| DL-T010 | verify     | Valid ID in tracker            | success=true, marked as verified   |
| DL-T011 | verify     | Invalid ID (not in tracker)    | success=false, not found           |
| DL-T012 | verify     | tracker undefined              | Error: tracker not available       |
| DL-T020 | list       | filter: status=pending         | Only pending deliverables          |
| DL-T021 | list       | filter: status=passed          | Only passed deliverables           |
| DL-T022 | list       | filter: status=blocked         | Only blocked deliverables          |
| DL-T023 | list       | filter: verified=true+tracker  | Only verified deliverables         |
| DL-T024 | list       | filter: verified=false+tracker | Only unverified deliverables       |
| DL-T025 | list       | filter: verified, no tracker   | verified filter ignored            |
| DL-T026 | list       | limit: 3                       | Max 3 results returned             |
| DL-T027 | list       | no filter                      | All active deliverables            |
| DL-T028 | list       | sync instruction context       | Tool available, returns list       |

### Configuration

| ID      | Input                                    | Expected Output                    |
| ------- | ---------------------------------------- | ---------------------------------- |
| SC-C001 | No agent.json                            | Use hardcoded settings only        |
| SC-C002 | User configures mcpServers               | User priority (see Section 5.4)    |
| SC-C003 | User adds custom permissions             | Merged, security baseline enforced |
| SC-C004 | User adds custom hooks                   | Merged, security baseline enforced |
| SC-C005 | User tries to disable sandbox            | Ignored, sandbox always enabled    |
| SC-C006 | User tries to remove .autonoe protection | Security baseline re-applied       |
| SC-C007 | Verify sandbox configuration             | enabled=true, autoAllow=true       |

### Prerequisites

| ID      | Input                    | Expected Output                     |
| ------- | ------------------------ | ----------------------------------- |
| SC-P001 | SPEC.md not found (run)  | Exit with error, non-zero exit code |
| SC-P002 | SPEC.md not found (sync) | Exit with error, non-zero exit code |
| SC-P003 | SPEC.md exists           | Command proceeds normally           |

### Option Validation

| ID      | Option             | Input | Expected Output                    |
| ------- | ------------------ | ----- | ---------------------------------- |
| SC-V001 | `--thinking`       | 1024  | Valid, command proceeds            |
| SC-V002 | `--thinking`       | 1023  | Exit with error (below minimum)    |
| SC-V003 | `--thinking`       | 8192  | Valid (default value)              |
| SC-V004 | `--max-iterations` | 1     | Valid, command proceeds            |
| SC-V005 | `--max-iterations` | 0     | Exit with error (must be positive) |
| SC-V006 | `--max-iterations` | -1    | Exit with error (must be positive) |
| SC-V007 | `--max-retries`    | 0     | Valid (no retries)                 |
| SC-V008 | `--max-retries`    | -1    | Exit with error (must be >= 0)     |

### Language Profiles

| ID      | Profile Config       | Command         | Expected Output                    |
| ------- | -------------------- | --------------- | ---------------------------------- |
| PR-X001 | (default)            | `npm install`   | Allowed (all profiles enabled)     |
| PR-X002 | (default)            | `pip install`   | Allowed (all profiles enabled)     |
| PR-X003 | (default)            | `go build`      | Allowed (all profiles enabled)     |
| PR-X004 | `"node"`             | `npm install`   | Allowed (node profile active)      |
| PR-X005 | `"node"`             | `pip install`   | Denied (python profile inactive)   |
| PR-X006 | `"python"`           | `pip install`   | Allowed (python profile active)    |
| PR-X007 | `"python"`           | `npm install`   | Denied (node profile inactive)     |
| PR-X008 | `["node", "python"]` | `npm install`   | Allowed (node profile active)      |
| PR-X009 | `["node", "python"]` | `pip install`   | Allowed (python profile active)    |
| PR-X010 | `["node", "python"]` | `go build`      | Denied (go profile inactive)       |
| PR-X011 | (default) + custom   | `custom-cli`    | Allowed (allowCommands)            |
| PR-X012 | (default)            | `pkill uvicorn` | Allowed (python pkill targets)     |
| PR-X013 | `"node"`             | `pkill uvicorn` | Denied (python pkill targets only) |
| PR-X014 | (default) + custom   | `pkill custom`  | Allowed (allowPkillTargets)        |

### Logger

| ID      | Input                        | Expected Output                 |
| ------- | ---------------------------- | ------------------------------- |
| SC-L001 | TestLogger captures info     | Message in entries with level   |
| SC-L002 | TestLogger captures debug    | Message in entries with level   |
| SC-L003 | silentLogger discards output | No side effects                 |
| SC-L004 | Session uses injected logger | Messages captured in TestLogger |
| SC-L005 | TestLogger captures warning  | Message in entries with level   |
| SC-L006 | TestLogger captures error    | Message in entries with level   |

### Claude Agent Client

| ID       | Function             | Input                      | Expected Output                  |
| -------- | -------------------- | -------------------------- | -------------------------------- |
| SC-AC001 | toSdkMcpServers      | Empty record               | Empty record                     |
| SC-AC002 | toSdkMcpServers      | Server with args           | SDK format preserved             |
| SC-AC003 | toStreamEvent        | text block                 | StreamEventText                  |
| SC-AC004 | toStreamEvent        | tool_use block             | StreamEventToolInvocation        |
| SC-AC005 | toStreamEvent        | tool_result block          | StreamEventToolResponse          |
| SC-AC016 | toStreamEvent        | thinking block             | StreamEventThinking              |
| SC-AC011 | toStreamEvents       | SDK message with content   | Generator\<StreamEvent\>         |
| SC-AC012 | toSessionEnd         | Result with total_cost_usd | StreamEventEnd with totalCostUsd |
| SC-AC013 | detectClaudeCodePath | claude found               | Path string                      |
| SC-AC014 | detectClaudeCodePath | claude not found           | undefined                        |

### ClaudeAgentClient SDK Options Assembly

| ID        | Category          | Input                                | Expected Output                   |
| --------- | ----------------- | ------------------------------------ | --------------------------------- |
| SC-CAC001 | base              | `{ cwd: '/project' }`                | `sdkOptions.cwd` set              |
| SC-CAC002 | base              | `{ model: 'claude-sonnet-4' }`       | `sdkOptions.model` set            |
| SC-CAC010 | mcpServers        | both undefined                       | `sdkOptions.mcpServers` undefined |
| SC-CAC011 | mcpServers        | external only                        | converted via toSdkMcpServers     |
| SC-CAC012 | mcpServers        | SDK MCP only                         | converted to record format        |
| SC-CAC013 | mcpServers        | both external + SDK                  | merged, SDK takes precedence      |
| SC-CAC020 | permissionLevel   | undefined                            | `permissionMode` undefined        |
| SC-CAC021 | permissionLevel   | `'acceptEdits'`                      | `permissionMode` set              |
| SC-CAC030 | allowedTools      | undefined                            | `allowedTools` undefined          |
| SC-CAC031 | allowedTools      | `['Read', 'Write']`                  | `allowedTools` set                |
| SC-CAC040 | sandbox           | undefined                            | `sandbox` undefined               |
| SC-CAC041 | sandbox           | `{ enabled: true, autoAllow: true }` | `sandbox` set with both fields    |
| SC-CAC050 | preToolUseHooks   | undefined                            | `hooks` undefined                 |
| SC-CAC051 | preToolUseHooks   | `[]`                                 | `hooks` undefined                 |
| SC-CAC052 | preToolUseHooks   | `[hook]`                             | `hooks.PreToolUse` converted      |
| SC-CAC060 | maxThinkingTokens | undefined                            | `maxThinkingTokens` undefined     |
| SC-CAC061 | maxThinkingTokens | `8192`                               | `maxThinkingTokens` set           |

### ClientFactory Sandbox Passthrough

| ID       | Command | sandboxMode           | Expected sandbox to Client    |
| -------- | ------- | --------------------- | ----------------------------- |
| SC-CF001 | run     | SandboxMode.enabled() | config.sandbox (enabled=true) |
| SC-CF002 | run     | disabledByCli()       | undefined                     |
| SC-CF003 | run     | disabledByEnv()       | undefined                     |
| SC-CF004 | sync    | SandboxMode.enabled() | config.sandbox (enabled=true) |
| SC-CF005 | sync    | disabledByEnv()       | undefined                     |

### Autonoe Protection

| ID       | Input                              | Expected Output |
| -------- | ---------------------------------- | --------------- |
| SC-AP001 | file_path: `.autonoe/status.json`  | Block           |
| SC-AP002 | file_path: `src/index.ts`          | Approve         |
| SC-AP003 | file_path: `/abs/.autonoe/file`    | Block           |
| SC-AP004 | file_path: `./project/.autonoe/x`  | Block           |
| SC-AP005 | file_path: undefined               | Approve         |
| SC-AP006 | filePath (camelCase): `.autonoe/x` | Block           |
| SC-AP007 | Windows path: `.autonoe\\file`     | Block           |
| SC-AP008 | file_path: `.autonoe-note.md`      | Approve         |

### Duration Format

| ID     | Input (ms) | Expected Output |
| ------ | ---------- | --------------- |
| DU-001 | 0          | `0s`            |
| DU-002 | 5000       | `5s`            |
| DU-003 | 60000      | `1m`            |
| DU-004 | 90000      | `1m 30s`        |
| DU-005 | 3600000    | `1h`            |
| DU-006 | 3661000    | `1h 1m 1s`      |
| DU-007 | 3660000    | `1h 1m`         |

---

## Integration Test Scenarios `[Consistency]`

Integration tests require real SDK, Docker, and external services. They are separated from unit tests due to execution time and API costs.

### Test Architecture

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

### Test Execution Flow

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

The `./tmp/` directory serves as the Docker volume mount point for test fixtures.

### Test Separation Strategy

| Test Type   | Location             | Command                 | CI Trigger       |
| ----------- | -------------------- | ----------------------- | ---------------- |
| Unit        | `packages/*/tests/`  | `bun run test`          | Every commit     |
| Integration | `tests/integration/` | `make test-integration` | Manual / Nightly |

### Test Categories

| Category    | Scenarios         | Description                             |
| ----------- | ----------------- | --------------------------------------- |
| End-to-End  | IT-001 ~ IT-005   | Full workflow with CLI and deliverables |
| SDK Sandbox | SC-X003           | Filesystem boundary enforcement         |
| Browser     | SC-B001 ~ SC-B004 | Playwright MCP server integration       |

### End-to-End Test Cases

#### IT-001: Technology Stack Recognition

| Field        | Value                                 |
| ------------ | ------------------------------------- |
| **Scenario** | Node.js technology stack handling     |
| **Command**  | `autonoe run`                         |
| **Fixture**  | `tests/integration/fixtures/nodejs/`  |
| **Expected** | `hello.js` exists, executes correctly |

#### IT-002: Instruction Override

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| **Scenario** | Custom instruction loading                       |
| **Command**  | `autonoe run`                                    |
| **Fixture**  | `tests/integration/fixtures/custom-instruction/` |
| **Expected** | Agent outputs custom marker text                 |

#### IT-003: Session Iteration Limit

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| **Scenario** | Max iterations respected                  |
| **Command**  | `autonoe run`                             |
| **Fixture**  | `tests/integration/fixtures/hello-world/` |
| **Expected** | Exits with code 0 or 1 (graceful)         |

#### IT-004: Sync Without Status.json

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| **Scenario** | Sync command creates deliverables from SPEC.md   |
| **Command**  | `autonoe sync`                                   |
| **Fixture**  | `tests/integration/fixtures/hello-world/`        |
| **Expected** | `.autonoe/status.json` created with deliverables |

#### IT-005: Sync With Existing Status.json

| Field        | Value                                               |
| ------------ | --------------------------------------------------- |
| **Scenario** | Sync command updates existing status                |
| **Command**  | `autonoe sync`                                      |
| **Fixture**  | `tests/integration/fixtures/sync-existing/`         |
| **Expected** | New deliverable created, old deliverable deprecated |

### SDK Sandbox Test Cases

| ID      | Input                     | Expected Output   |
| ------- | ------------------------- | ----------------- |
| SC-X003 | File read outside project | Permission denied |

### Browser Test Cases

| ID      | Input                   | Expected Output                  |
| ------- | ----------------------- | -------------------------------- |
| SC-B001 | Navigate to example.com | Page loaded, screenshot captured |
| SC-B002 | Click without snapshot  | Error: snapshot required         |
| SC-B003 | Form submission         | Form submitted, verified         |
| SC-B004 | Text verification       | Assertion passes/fails           |

### CI Reporting

Integration tests generate GitHub Actions Job Summary when running in CI:

| Element       | Content                                         |
| ------------- | ----------------------------------------------- |
| Methodology   | How tests work (fixture → execute → verify)     |
| Summary Table | Test ID, name, pass/fail status                 |
| Test Details  | Verification criteria, agent notes, status.json |

**Environment Detection:**

Summary is generated only when `GITHUB_STEP_SUMMARY` environment variable is set. Local runs output console summary only.

**Artifacts Captured:**

| File                   | Description                               |
| ---------------------- | ----------------------------------------- |
| `.autonoe-note.md`     | Agent handoff notes (if created)          |
| `.autonoe/status.json` | Deliverable status with pass/block states |
