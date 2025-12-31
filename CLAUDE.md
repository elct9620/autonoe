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
bun run test --project claude-agent-client         # Run claude-agent-client tests
bun run test packages/core/tests/session.test.ts   # Run a single test file
```

Project names: `core`, `claude-agent-client` (defined in each package's `vitest.config.ts`).

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
│       packages/core             │  │  packages/claude-agent-client   │
│  SessionRunner, Session         │  │  ClaudeAgentClient (SDK wrapper)│
│  BashSecurity, Configuration    │  │  Converters (SDK ↔ Domain)      │
│  Types (NO external deps)       │  │  Depends on @autonoe/core       │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

**Key flow**: CLI → `SessionRunner.run(factory, logger)` → loop creates `Session` → `client.query()` returns `MessageStream` → process `StreamEvent` discriminated union → terminates when all deliverables pass

### Packages

- `@autonoe/cli` - Entry point, argument parsing with CAC
- `@autonoe/core` - Session orchestration, domain types, security hooks (NO external deps)
- `@autonoe/claude-agent-client` - SDK wrapper implementing `AgentClient` interface

### Dependency Rule

```
apps/cli
    ├── @autonoe/core (types, SessionRunner)
    └── @autonoe/claude-agent-client (ClaudeAgentClient)
            └── @autonoe/core (types only)
```

`packages/core` has NO external dependencies - pure domain + application logic.

### Domain Model

**StreamEvent** - Discriminated union processed by Session:
- `AgentText` - Text output from agent
- `ToolInvocation` - Agent requesting tool execution
- `ToolResponse` - Result returned to agent
- `SessionEnd` - Terminal state with result/errors/cost

**DeliverableStatus** - Aggregate tracking work completion (persisted to `.autonoe/status.json`)

## Conventions

- **Formatting**: Prettier with `semi: false`, `singleQuote: true`
- **Commits**: Conventional commits format
- **TypeScript**: Strict mode, ESNext target/module
- **Prompts**: Markdown files imported via `with { type: 'text' }` (requires `markdown.d.ts`)

## Security Model (Three-Layer Architecture)

```
Layer 1: SDK Sandbox (enabled: true, autoAllowBashIfSandboxed: true)
Layer 2: Filesystem Scope (SDK permissions: "./**")
Layer 3: PreToolUse Hooks
         ├── BashSecurity: Command allowlist with argument validation
         └── AutonoeProtection: Block direct writes to .autonoe/
```

See `SPEC.md` Section 6 for bash command allowlist and validation rules.

## Pending Implementation

- **Prompt System** - `packages/core/src/instructions.ts` and `instructions/*.md` (see SPEC.md Appendix A)

## Specification

`SPEC.md` is the single source of truth for requirements, interfaces, and scenarios. Always consult it when implementing new features.
