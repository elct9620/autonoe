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

| Category        | Capability | Scope                  |
| --------------- | ---------- | ---------------------- |
| File Read       | YES        | All files              |
| Git             | YES        | Full access            |
| autonoe         | YES        | status.json management |
| .autonoe/ Write | NO         | Block direct writes    |

### Base Bash Commands

Base profile contains two command layers:

**Status Layer (verification)** - Available in all modes including `sync`:

| Category   | Commands                                 |
| ---------- | ---------------------------------------- |
| Navigation | ls, pwd, cat, head, tail, wc, find, grep |
| Text       | tree, sort, diff, date                   |
| Git        | git                                      |
| Utility    | echo, sleep                              |

**Operations Layer (development)** - Only available in `run` mode:

| Category | Commands                       |
| -------- | ------------------------------ |
| Text     | printf, uniq, cut, tr, tac, jq |
| Process  | which, ps, lsof                |
| File Ops | mkdir, cp                      |

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

Each profile contains two command layers:

- **Verification**: Test, type check, lint commands (used by `sync`)
- **Development**: Full toolchain including verification (used by `run`)

#### Node.js Profile

| Category  | Verification                                        | Development                         |
| --------- | --------------------------------------------------- | ----------------------------------- |
| Runtime   | -                                                   | node, bun, deno                     |
| Package   | -                                                   | npm, npx, yarn, pnpm                |
| Build     | npm run build, bun run build                        | tsc, esbuild, vite, webpack, rollup |
| Test      | npm test, bun test, vitest, jest, playwright, mocha | -                                   |
| Type      | tsc --noEmit                                        | -                                   |
| Lint      | eslint, prettier --check, biome check               | prettier --write, biome format      |
| Framework | -                                                   | next, nuxt, astro, remix            |

#### Python Profile

| Category  | Verification               | Development                            |
| --------- | -------------------------- | -------------------------------------- |
| Runtime   | -                          | python, python3                        |
| Package   | -                          | pip, pip3, pipx, uv                    |
| Venv      | -                          | venv, virtualenv, conda                |
| Build     | -                          | poetry, pdm, hatch, flit               |
| Test      | pytest, tox, nox           | -                                      |
| Type      | mypy, pyright              | -                                      |
| Lint      | ruff check, flake8, pylint | ruff format, black                     |
| Framework | -                          | django-admin, flask, uvicorn, gunicorn |

#### Ruby Profile

| Category  | Verification              | Development                  |
| --------- | ------------------------- | ---------------------------- |
| Runtime   | -                         | ruby, irb                    |
| Package   | -                         | gem, bundle, bundler         |
| Build     | -                         | rake, thor                   |
| Test      | rspec, minitest, cucumber | -                            |
| Lint      | rubocop, standard         | rubocop -a, rubocop -A       |
| Framework | -                         | rails, hanami, puma, unicorn |

#### Go Profile

| Category | Verification                       | Development            |
| -------- | ---------------------------------- | ---------------------- |
| Runtime  | -                                  | go run                 |
| Build    | go build                           | go install             |
| Test     | go test                            | -                      |
| Format   | gofmt -d                           | gofmt -w, goimports    |
| Lint     | golint, golangci-lint, staticcheck | -                      |
| Tools    | -                                  | gopls, dlv, goreleaser |

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

| Capability | Base            | Sync                    |
| ---------- | --------------- | ----------------------- |
| File Write | None            | .autonoe-note.md only   |
| File Edit  | None            | .autonoe-note.md only   |
| Bash       | Status commands | Verification layer only |
| Playwright | N/A             | Enabled (verify phase)  |

### Allowed Tools

| Tool Category | Available | Scope                      |
| ------------- | --------- | -------------------------- |
| File Read     | YES       | All files                  |
| File Write    | LIMITED   | .autonoe-note.md only      |
| File Edit     | LIMITED   | .autonoe-note.md only      |
| Bash          | LIMITED   | Verification commands only |
| Git           | YES       | Full access                |
| Playwright    | YES       | Verification phase         |
| autonoe       | YES       | status.json updates        |

### Allowed Bash Commands

Sync uses the **verification layer** from each active profile. Only verification commands are allowed:

| Profile | Verification Commands                                                                    |
| ------- | ---------------------------------------------------------------------------------------- |
| base    | ls, pwd, cat, head, tail, wc, find, grep, tree, sort, diff, date, git, echo, sleep       |
| node    | npm, npx, bun, yarn, pnpm, vitest, jest, playwright, mocha, tsc, eslint, prettier, biome |
| python  | pip, pip3, pipx, uv, pytest, tox, nox, mypy, pyright, ruff, flake8, pylint               |
| ruby    | bundle, bundler, gem, rspec, minitest, cucumber, rubocop, standard                       |
| go      | go, gofmt, goimports, golangci-lint, staticcheck                                         |

**Notes:**

- Package managers are allowed for running test scripts (e.g., `npm test`, `bundle exec rspec`)
- Auto-fix commands (e.g., `prettier --write`, `rubocop -a`) are excluded
- User extensions (`allowCommands`) are ignored in sync mode

**Profile × Command Behavior:**

| agent.json profile | Sync Allowed Commands                             |
| ------------------ | ------------------------------------------------- |
| (not set)          | Base.status + All profiles' verification          |
| `"node"`           | Base.status + Node.verification                   |
| `"python"`         | Base.status + Python.verification                 |
| `["node", "go"]`   | Base.status + Node.verification + Go.verification |

### Blocked Commands

| Category             | Commands                                    | Reason                      |
| -------------------- | ------------------------------------------- | --------------------------- |
| File modification    | `sed -i`, `rm`, `mv`, `cp`                  | Prevents source changes     |
| Package installation | `npm install`, `pip install`, `gem install` | Prevents dependency changes |
| Auto-fix             | `prettier --write`, `rubocop -a`, `black`   | Modifies source code        |

### Protected Scope

| Resource               | Access     | Enforcement                      |
| ---------------------- | ---------- | -------------------------------- |
| Project source files   | Read-only  | Write/Edit blocked               |
| `.autonoe/status.json` | Tool-only  | Write only via deliverable tools |
| `.autonoe-note.md`     | Read/Write | Status reporting allowed         |
| Git                    | Full       | Commit sync results allowed      |
