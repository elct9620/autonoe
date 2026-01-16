# Security Details

This document contains detailed security configurations for Autonoe's security layer. For the security architecture overview, see [SPEC.md Section 6](../SPEC.md#6-security-design).

---

## Overview

Autonoe provides two execution modes built on a shared Base Security:

| Mode   | Purpose        | Base | Modifications                                      |
| ------ | -------------- | ---- | -------------------------------------------------- |
| `run`  | Implementation | ✓    | + Write, + Profiles, + Playwright                  |
| `sync` | Verification   | ✓    | - Write scope, - Bash scope, + Playwright (verify) |

---

## Base Security

Shared security capabilities for all execution modes.

### Base Tools

| Category        | Capability | Scope                  |
| --------------- | ---------- | ---------------------- |
| File Read       | YES        | All files              |
| Git             | YES        | Full access            |
| Autonoe Tool    | YES        | Deliverable management |
| Temp Directory  | YES        | /tmp/\*\* (read/write) |
| .autonoe/ Write | NO         | Block direct writes    |

### Base Bash Commands

Base commands are all read-only and available in all modes (run and sync):

| Category        | Commands                                               |
| --------------- | ------------------------------------------------------ |
| Navigation      | ls, pwd, cat, head, tail, wc, find, grep               |
| Text Processing | tree, sort, diff, date, printf, uniq, cut, tr, tac, jq |
| Git             | git                                                    |
| Process Query   | which, ps, lsof                                        |
| Utility         | echo, sleep                                            |

**Run Command Extensions** - Only available in `run` mode:

| Category | Commands  |
| -------- | --------- |
| File Ops | mkdir, cp |

### Validation Flow

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

### Command Chain Handling

| Rule       | Description                                                |
| ---------- | ---------------------------------------------------------- |
| Operators  | `&&`, `\|\|`, `\|`, `;`                                    |
| Validation | If ANY command in chain is blocked, ENTIRE chain is denied |
| Parsing    | Shell-aware tokenizer (handle quotes, escapes)             |

---

## `run` Command Security

`run` mode extends Base Security with additional capabilities for implementation.

### Additional Capabilities

| Addition         | Description                       |
| ---------------- | --------------------------------- |
| File Write       | Full project access               |
| File Edit        | Full project access               |
| Playwright       | Browser automation via MCP        |
| Profile Commands | Language-specific allowlists      |
| User Extensions  | Custom commands via agent.json    |
| Runtime Options  | --allow-destructive, --no-sandbox |

### Language Profile Commands

Language profile commands are available in both `run` and `sync` modes. The only difference between modes is that `sync` excludes file operation commands (mkdir, cp).

#### Node.js Profile

| Category  | Commands                        |
| --------- | ------------------------------- |
| Runtime   | node, deno                      |
| Package   | npm, npx, bun, yarn, pnpm       |
| Test      | vitest, jest, playwright, mocha |
| Type      | tsc                             |
| Lint      | eslint, prettier, biome         |
| Build     | esbuild, vite, webpack, rollup  |
| Framework | next, nuxt, astro, remix        |

#### Python Profile

| Category  | Commands                               |
| --------- | -------------------------------------- |
| Runtime   | python, python3                        |
| Package   | pip, pip3, pipx, uv                    |
| Venv      | venv, virtualenv, conda                |
| Build     | poetry, pdm, hatch, flit               |
| Test      | pytest, tox, nox                       |
| Type      | mypy, pyright                          |
| Lint      | ruff, flake8, pylint, black            |
| Framework | django-admin, flask, uvicorn, gunicorn |

#### Ruby Profile

| Category  | Commands                     |
| --------- | ---------------------------- |
| Runtime   | ruby, irb                    |
| Package   | gem, bundle, bundler         |
| Build     | rake, thor                   |
| Test      | rspec, minitest, cucumber    |
| Lint      | rubocop, standard            |
| Framework | rails, hanami, puma, unicorn |

#### Go Profile

| Category | Commands                           |
| -------- | ---------------------------------- |
| Runtime  | go                                 |
| Format   | gofmt, goimports                   |
| Lint     | golangci-lint, staticcheck, golint |
| Tools    | gopls, dlv, goreleaser             |

### Argument Validation

Commands requiring additional argument checks:

#### chmod validation

| Allowed                           | Blocked                             | Required           |
| --------------------------------- | ----------------------------------- | ------------------ |
| +x, u+x, g+x, o+x, a+x, ug+x, etc | -R (recursive), numeric modes (755) | mode + target file |

#### pkill validation (per profile)

| Profile | Allowed Targets                    |
| ------- | ---------------------------------- |
| Base    | (none)                             |
| Node.js | node, npm, npx, vite, next         |
| Python  | python, python3, uvicorn, gunicorn |
| Ruby    | ruby, puma, unicorn, rails         |
| Go      | go                                 |

#### bin/dev.sh validation

| Allowed                      | Blocked                           |
| ---------------------------- | --------------------------------- |
| `./bin/dev.sh`, `bin/dev.sh` | Any arguments (prevent injection) |

### User Extensions

Custom commands via `agent.json`:

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

### Runtime Security Options

#### CLI Flags

| Flag                | Alias | Type    | Default | Description                                    |
| ------------------- | ----- | ------- | ------- | ---------------------------------------------- |
| --allow-destructive | -D    | boolean | false   | Enable rm and mv commands with path validation |
| --no-sandbox        | -     | boolean | false   | Disable SDK sandbox                            |

#### Destructive Commands (--allow-destructive)

| Command | Validation                      |
| ------- | ------------------------------- |
| rm      | Path validation required        |
| mv      | Source + destination validation |

#### Path Validation

```
Input Path
    │
    ▼
┌───────────────────────────────────────┐
│ 1. Resolve against projectDir         │
│    path.resolve(projectDir, input)    │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│ 2. Resolve symlinks                   │
│    fs.realpathSync(resolved)          │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│ 3. Normalize (remove . and ..)        │
│    path.normalize(final)              │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│ 4. Verify starts with projectDir      │
│    normalized.startsWith(projectDir)  │
└───────────────────┬───────────────────┘
                    │
         ┌─────────┴─────────┐
         ▼                   ▼
    ┌─────────┐         ┌─────────┐
    │  ALLOW  │         │  DENY   │
    │ (inside)│         │(outside)│
    └─────────┘         └─────────┘
```

#### Blocked Flags

| Command | Blocked Flags      | Reason                   |
| ------- | ------------------ | ------------------------ |
| rm      | --no-preserve-root | Bypasses root protection |

#### Error Messages

| Condition            | Message                                       |
| -------------------- | --------------------------------------------- |
| Path escapes project | `Path '{path}' escapes project directory`     |
| Blocked flag         | `Flag '{flag}' is not allowed with {command}` |
| Symlink escapes      | `Symlink target escapes project directory`    |

#### Warning Messages (stderr)

| Trigger             | Message                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| --allow-destructive | `Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.` |
| --no-sandbox        | `Warning: SDK sandbox is disabled. System-level isolation is not enforced.`                      |
| AUTONOE_NO_SANDBOX  | `Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.`                     |

Pattern: `Warning: [what is enabled/disabled]. [consequence/risk].`

---

## `sync` Command Security

`sync` mode restricts Base Security for verification-only operations. Prevents modification of project source code while allowing status management.

### Restrictions from Base

| Capability | Base               | Sync                           |
| ---------- | ------------------ | ------------------------------ |
| File Write | None               | .autonoe-note.md only          |
| File Edit  | None               | .autonoe-note.md only          |
| Bash       | Read-only commands | + Profile commands, - File ops |
| Playwright | N/A                | Enabled                        |

### Allowed Tools

| Tool Category | Available | Scope                                   |
| ------------- | --------- | --------------------------------------- |
| File Read     | YES       | All files                               |
| File Write    | LIMITED   | .autonoe-note.md only                   |
| File Edit     | LIMITED   | .autonoe-note.md only                   |
| Bash          | LIMITED   | Base read-only + profiles (no file ops) |
| Git           | YES       | Full access                             |
| Playwright    | YES       | Browser automation                      |
| Autonoe Tool  | YES       | Deliverable management                  |

### Allowed Bash Commands

Sync uses **Base read-only commands** plus **all language profile commands**. The only difference from `run` command is that file operation commands (mkdir, cp) are excluded.

| Profile | Commands                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| base    | All read-only commands (see Base Bash Commands above)                                                      |
| node    | npm, npx, bun, yarn, pnpm, vitest, jest, playwright, mocha, tsc, eslint, prettier, biome, node, deno, etc. |
| python  | pip, pip3, pipx, uv, pytest, tox, nox, mypy, pyright, ruff, flake8, pylint, python, python3, poetry, etc.  |
| ruby    | bundle, bundler, gem, rspec, minitest, cucumber, rubocop, standard, ruby, irb, rake, rails, etc.           |
| go      | go, gofmt, goimports, golangci-lint, staticcheck, golint, gopls, dlv, goreleaser                           |

**Profile × Command Behavior:**

| agent.json profile | Sync Allowed Commands                      |
| ------------------ | ------------------------------------------ |
| (not set)          | Base read-only + All profiles              |
| `"node"`           | Base read-only + Node profile              |
| `"python"`         | Base read-only + Python profile            |
| `["node", "go"]`   | Base read-only + Node profile + Go profile |

**Note:** User extensions (`allowCommands`) with `sync` key are respected in `sync` command.

### Blocked Commands

| Category        | Commands      | Reason                 |
| --------------- | ------------- | ---------------------- |
| File operations | `mkdir`, `cp` | `run` mode only        |
| Destructive     | `rm`, `mv`    | Always blocked in sync |

### Protected Scope

| Resource               | Access     | Enforcement                 |
| ---------------------- | ---------- | --------------------------- |
| Project source files   | Read-only  | Write/Edit blocked          |
| `.autonoe/status.json` | Tool-only  | Write only via Autonoe Tool |
| `.autonoe-note.md`     | Read/Write | Status reporting allowed    |
| Git                    | Full       | Commit sync results allowed |
