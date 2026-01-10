# Security Details

This document contains detailed security configurations for Autonoe's security layer. For the security architecture overview, see [SPEC.md Section 6](../SPEC.md#6-security-design).

---

## Overview

Autonoe provides two execution modes built on a shared Base Security:

| Mode   | Purpose        | Base | Modifications                             |
| ------ | -------------- | ---- | ----------------------------------------- |
| `run`  | Implementation | ✓    | + Write, + Profiles, + Playwright         |
| `sync` | Verification   | ✓    | - Write scope, - Bash scope, - Playwright |

---

## Base Security

Shared security capabilities for all execution modes.

### Base Tools

| Category            | Capability | Scope                  |
| ------------------- | ---------- | ---------------------- |
| File Read           | YES        | All files              |
| Git                 | YES        | Full access            |
| autonoe-deliverable | YES        | status.json management |
| .autonoe/ Write     | NO         | Block direct writes    |

### Base Bash Commands

Status and navigation commands available in all modes:

| Category   | Commands                                               |
| ---------- | ------------------------------------------------------ |
| Navigation | ls, pwd, cat, head, tail, wc, find, grep               |
| Text       | tree, sort, diff, printf, date, uniq, cut, tr, tac, jq |
| Process    | echo, which, ps, lsof, sleep                           |
| File Ops   | mkdir                                                  |
| Git        | git                                                    |

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

## Run Command Security

Run mode extends Base Security with additional capabilities for implementation.

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

#### Node.js Profile

| Category  | Commands                            |
| --------- | ----------------------------------- |
| Runtime   | node, bun, deno                     |
| Package   | npm, npx, yarn, pnpm                |
| Build     | tsc, esbuild, vite, webpack, rollup |
| Test      | jest, vitest, playwright, mocha     |
| Lint      | eslint, prettier, biome             |
| Framework | next, nuxt, astro, remix            |

#### Python Profile

| Category  | Commands                               |
| --------- | -------------------------------------- |
| Runtime   | python, python3                        |
| Package   | pip, pip3, pipx, uv                    |
| Venv      | venv, virtualenv, conda                |
| Build     | poetry, pdm, hatch, flit               |
| Test      | pytest, tox, nox                       |
| Lint      | ruff, black, mypy, flake8, pylint      |
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
| Lint     | golint, golangci-lint, staticcheck |
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

## Sync Command Security

Sync mode restricts Base Security for verification-only operations. Prevents modification of project source code while allowing status management.

### Restrictions from Base

| Capability | Base            | Sync                  |
| ---------- | --------------- | --------------------- |
| File Write | None            | .autonoe-note.md only |
| File Edit  | None            | .autonoe-note.md only |
| Bash       | Status commands | Test/lint/build only  |
| Playwright | N/A             | Disabled              |

### Allowed Tools

| Tool Category       | Available | Scope                      |
| ------------------- | --------- | -------------------------- |
| File Read           | YES       | All files                  |
| File Write          | LIMITED   | .autonoe-note.md only      |
| File Edit           | LIMITED   | .autonoe-note.md only      |
| Bash                | LIMITED   | Verification commands only |
| Git                 | YES       | Full access                |
| Playwright          | NO        | Disabled                   |
| autonoe-deliverable | YES       | status.json updates        |

### Allowed Bash Commands

Verification commands only:

| Category      | Commands                                             |
| ------------- | ---------------------------------------------------- |
| Test runners  | `npm test`, `bun test`, `pytest`, `rspec`, `go test` |
| Type checking | `tsc --noEmit`, `mypy`, `pyright`                    |
| Linting       | `eslint`, `prettier --check`, `rubocop`              |
| Build check   | `npm run build`, `bun run build`, `go build`         |
| Status        | `ls`, `cat`, `head`, `tail`                          |

### Blocked Commands

| Category             | Commands                                    | Reason                      |
| -------------------- | ------------------------------------------- | --------------------------- |
| File modification    | `echo >`, `sed -i`, `rm`, `mv`, `cp`        | Prevents source changes     |
| Package installation | `npm install`, `pip install`, `gem install` | Prevents dependency changes |

### Protected Scope

| Resource               | Access     | Enforcement                      |
| ---------------------- | ---------- | -------------------------------- |
| Project source files   | Read-only  | Write/Edit blocked               |
| `.autonoe/status.json` | Tool-only  | Write only via deliverable tools |
| `.autonoe-note.md`     | Read/Write | Status reporting allowed         |
| Git                    | Full       | Commit sync results allowed      |
