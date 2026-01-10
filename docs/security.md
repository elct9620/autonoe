# Bash Command Security Details

This document contains detailed bash command allowlists and validation rules for Autonoe's security layer. For the security architecture overview, see [SPEC.md Section 6](../SPEC.md#6-security-design).

---

## Command Allowlists

### Base Profile (always included)

| Category   | Commands                                               | Validation       |
| ---------- | ------------------------------------------------------ | ---------------- |
| Navigation | ls, pwd, cat, head, tail, wc, find, grep               | Allowlist        |
| File Ops   | mkdir, cp, chmod                                       | chmod: args      |
| Git        | git                                                    | Allowlist        |
| Process    | echo, which, ps, lsof, sleep, pkill                    | pkill: args      |
| Script     | bin/dev.sh                                             | bin/dev.sh: args |
| Text       | tree, sort, diff, printf, date, uniq, cut, tr, tac, jq | Allowlist        |

### Node.js Profile

| Category  | Commands                            |
| --------- | ----------------------------------- |
| Runtime   | node, bun, deno                     |
| Package   | npm, npx, yarn, pnpm                |
| Build     | tsc, esbuild, vite, webpack, rollup |
| Test      | jest, vitest, playwright, mocha     |
| Lint      | eslint, prettier, biome             |
| Framework | next, nuxt, astro, remix            |

### Python Profile

| Category  | Commands                               |
| --------- | -------------------------------------- |
| Runtime   | python, python3                        |
| Package   | pip, pip3, pipx, uv                    |
| Venv      | venv, virtualenv, conda                |
| Build     | poetry, pdm, hatch, flit               |
| Test      | pytest, tox, nox                       |
| Lint      | ruff, black, mypy, flake8, pylint      |
| Framework | django-admin, flask, uvicorn, gunicorn |

### Ruby Profile

| Category  | Commands                     |
| --------- | ---------------------------- |
| Runtime   | ruby, irb                    |
| Package   | gem, bundle, bundler         |
| Build     | rake, thor                   |
| Test      | rspec, minitest, cucumber    |
| Lint      | rubocop, standard            |
| Framework | rails, hanami, puma, unicorn |

### Go Profile

| Category | Commands                           |
| -------- | ---------------------------------- |
| Runtime  | go                                 |
| Format   | gofmt, goimports                   |
| Lint     | golint, golangci-lint, staticcheck |
| Tools    | gopls, dlv, goreleaser             |

---

## Argument Validation

Commands with `args` validation require additional checks:

### chmod validation

| Allowed                           | Blocked                             | Required           |
| --------------------------------- | ----------------------------------- | ------------------ |
| +x, u+x, g+x, o+x, a+x, ug+x, etc | -R (recursive), numeric modes (755) | mode + target file |

### pkill validation (per profile)

| Profile | Allowed Targets                    |
| ------- | ---------------------------------- |
| Base    | (none)                             |
| Node.js | node, npm, npx, vite, next         |
| Python  | python, python3, uvicorn, gunicorn |
| Ruby    | ruby, puma, unicorn, rails         |
| Go      | go                                 |

### bin/dev.sh validation

| Allowed                      | Blocked                           |
| ---------------------------- | --------------------------------- |
| `./bin/dev.sh`, `bin/dev.sh` | Any arguments (prevent injection) |

---

## User Extensions

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

---

## Validation Flow

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

---

## Command Chain Handling

- Operators: `&&`, `||`, `|`, `;`
- Rule: If ANY command in chain is blocked, ENTIRE chain is denied
- Parse: Use shell-aware tokenizer (handle quotes, escapes)

---

## Runtime Security Options

### CLI Flags

| Flag                | Alias | Type    | Default | Description                                    |
| ------------------- | ----- | ------- | ------- | ---------------------------------------------- |
| --allow-destructive | -D    | boolean | false   | Enable rm and mv commands with path validation |
| --no-sandbox        | -     | boolean | false   | Disable SDK sandbox                            |

### Enabled Commands (--allow-destructive)

| Command | Validation                      |
| ------- | ------------------------------- |
| rm      | Path validation required        |
| mv      | Source + destination validation |

### Path Validation

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

### Blocked Flags

| Command | Blocked Flags      | Reason                   |
| ------- | ------------------ | ------------------------ |
| rm      | --no-preserve-root | Bypasses root protection |

### Error Messages

| Condition            | Message                                       |
| -------------------- | --------------------------------------------- |
| Path escapes project | `Path '{path}' escapes project directory`     |
| Blocked flag         | `Flag '{flag}' is not allowed with {command}` |
| Symlink escapes      | `Symlink target escapes project directory`    |

### Warning Messages (stderr)

| Trigger             | Message                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| --allow-destructive | `Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.` |
| --no-sandbox        | `Warning: SDK sandbox is disabled. System-level isolation is not enforced.`                      |
| AUTONOE_NO_SANDBOX  | `Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.`                     |

Pattern: `Warning: [what is enabled/disabled]. [consequence/risk].`
