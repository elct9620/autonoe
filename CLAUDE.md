# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun run check          # Type checking
bun run format         # Format code with Prettier
bun run test           # Run all tests (vitest)
bun run compile        # Compile to single executable

# Run CLI directly
bun apps/cli/bin/autonoe.ts run
```

### Testing

```bash
bun run test                                       # Run all tests
bun run test --project core                        # Run core package tests
bun run test --project agent                       # Run agent package tests
bun run test packages/core/tests/session.test.ts   # Run a single test file
bun run test packages/agent/tests/converters.test.ts  # Agent package single test
bun run test --coverage                            # Run with coverage report
```

Project names: `core`, `agent` (defined in each package's `vitest.config.ts`). Coverage reports are generated in `./coverage/`.

### Integration Tests

```bash
make test-integration                              # Run all integration tests (requires Docker)
```

Integration tests are in `tests/integration/` and use Docker to run full end-to-end scenarios. They are separated from unit tests due to execution time and API costs.

### Docker

```bash
docker compose build                               # Build CLI image (node target)
docker compose run --rm cli autonoe run            # Run CLI in container

# Dockerfile verification (build targets: base, node, python, golang, ruby)
docker build --target python -f apps/cli/Dockerfile .
```

## Architecture

Autonoe is a Bun/TypeScript monorepo that orchestrates an autonomous coding agent via Claude's Agent SDK.

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/cli (Presentation)                                        │
│    Creates ClaudeAgentClient, injects into SessionRunner        │
└─────────────────────────────────────────────────────────────────┘
              │                                       │
              ▼                                       ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│       packages/core             │  │  packages/agent                 │
│  SessionRunner, Session         │  │  ClaudeAgentClient (SDK wrapper)│
│  BashSecurity, Configuration    │  │  Converters (SDK ↔ Domain)      │
│  Types (NO external deps)       │  │  Depends on @autonoe/core       │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

**Key flow**: CLI → `SessionRunner.run(factory, logger)` → loop creates `Session` → `client.query()` returns `MessageStream` → process `StreamEvent` discriminated union → terminates when all deliverables pass (or all non-blocked pass)

### Packages

- `@autonoe/cli` - Entry point, argument parsing with CAC
- `@autonoe/core` - Session orchestration, domain types, security hooks (NO external deps)
- `@autonoe/agent` - SDK wrapper implementing `AgentClient` interface

### Dependency Rule

```
apps/cli
    ├── @autonoe/core (types, SessionRunner)
    └── @autonoe/agent (ClaudeAgentClient)
            └── @autonoe/core (types only)
```

`packages/core` has NO external dependencies - pure domain + application logic.

### Domain Model

**StreamEvent** - Discriminated union processed by Session:
- `AgentText` - Text output from agent
- `AgentThinking` - Agent's internal reasoning (displayed in debug mode, truncated to 200 chars)
- `ToolInvocation` - Agent requesting tool execution
- `ToolResponse` - Result returned to agent
- `SessionEnd` - Terminal state with result/errors/cost
- `StreamError` - SDK error wrapped as event

**DeliverableStatus** - Aggregate tracking work completion (persisted to `.autonoe/status.json`)

## Conventions

- **Formatting**: Prettier with `semi: false`, `singleQuote: true`
- **Commits**: Conventional commits format
- **TypeScript**: Strict mode, ESNext target/module
- **Prompts**: Markdown files imported via `with { type: 'text' }` (requires `markdown.d.ts`)

## Commit Scopes & Release Please

Conventional commits 的 scope 會決定 Release Please 觸發哪個套件的版本更新：

| Scope | Package | Path |
|-------|---------|------|
| `core` | @autonoe/core | packages/core |
| `agent` | @autonoe/agent | packages/agent |
| `cli` | @autonoe/cli | apps/cli |

### Examples

```bash
# Triggers @autonoe/core release
feat(core): add new session state machine

# Triggers @autonoe/agent release
fix(agent): handle SDK timeout errors

# Triggers @autonoe/cli release
feat(cli): add --verbose flag

# No package release (docs, CI, etc.)
docs: update README
ci: add release workflow
```

### Rules

1. **Always use scope** for changes affecting specific packages
2. **Use package name as scope** (core, agent, cli)
3. **Omit scope** for cross-cutting changes (docs, ci, chore)
4. **Breaking changes** use `!` suffix: `feat(core)!: redesign API`

## Security Model (Three-Layer Architecture)

```
Layer 1: SDK Sandbox (enabled: true, autoAllowBashIfSandboxed: true)
Layer 2: Filesystem Scope (SDK permissions: "./**")
Layer 3: PreToolUse Hooks
         ├── BashSecurity: Command allowlist with argument validation
         └── AutonoeProtection: Block direct writes to .autonoe/
```

See `SPEC.md` Section 6 for bash command allowlist and validation rules.

## Specification

`SPEC.md` is the single source of truth for requirements, interfaces, and scenarios. Always consult it when implementing new features.

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | All domain types (StreamEvent, Deliverable, etc.) |
| `packages/core/src/sessionRunner.ts` | Session loop orchestration |
| `packages/core/src/session.ts` | Single session execution |
| `packages/core/src/loopState.ts` | Session loop state management |
| `packages/core/src/terminationEvaluator.ts` | Loop termination condition evaluation |
| `packages/core/src/bashSecurity.ts` | Command allowlist validation |
| `packages/core/src/autonoeProtection.ts` | .autonoe/ directory write protection hook |
| `packages/core/src/configuration.ts` | Security baseline and config loading |
| `packages/core/src/quotaManager.ts` | Quota detection and wait duration utilities |
| `packages/core/src/duration.ts` | Human-readable duration formatting |
| `packages/core/src/deliverableService.ts` | Deliverable CRUD operations |
| `packages/core/src/deliverableStatus.ts` | DeliverableStatus types and repository interface |
| `packages/agent/src/claudeAgentClient.ts` | SDK wrapper implementation |
| `packages/agent/src/converters.ts` | SDK ↔ Domain type conversions |
| `apps/cli/bin/autonoe.ts` | CLI entry point |
| `apps/cli/src/run.ts` | Run command implementation |

### Test Helpers

| File | Purpose |
|------|---------|
| `packages/core/tests/helpers/mockAgentClient.ts` | Mock AgentClient for unit tests |
| `packages/core/tests/helpers/testLogger.ts` | Logger that captures messages for assertions |
| `packages/core/tests/helpers/fixtures.ts` | StreamEvent factories for test data |
| `packages/core/tests/helpers/mockDeliverableStatusReader.ts` | Mock DeliverableStatusReader for tests |

## Extended Thinking Mode

Use `--thinking [budget]` to enable extended thinking mode:

```bash
bun apps/cli/bin/autonoe.ts run --thinking        # Default 8192 tokens
bun apps/cli/bin/autonoe.ts run --thinking 16384  # Custom budget
```

Minimum budget is 1024 tokens. Thinking content appears in debug output (`-d` flag).
