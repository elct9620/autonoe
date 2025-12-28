# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun run check          # Type checking
bun run format         # Format code with Prettier
bun run test           # Run tests (vitest)
bun run compile        # Compile to single executable

# Run CLI directly
bun apps/cli/bin/autonoe.ts run
```

## Architecture

Autonoe is a Bun/TypeScript monorepo that orchestrates an autonomous coding agent via Claude's Agent SDK.

```
apps/cli (Presentation)  →  packages/core (Application/Domain/Infrastructure)
                                    ↓
                            Coding Agent (Claude Agent SDK)
                                    ↓
                            MCP Servers (Playwright, Bash, File System)
```

**Key flow**: CLI parses args → `runSession(options)` → Agent reads SPEC.md → executes scenarios → updates `.autonoe/status.json` via StatusTool

### Packages

- `@autonoe/cli` - Entry point, argument parsing with CAC (`apps/cli/bin/autonoe.ts`)
- `@autonoe/core` - Session orchestration, exports `runSession()` and types

### Testing

Tests use Vitest with workspace configuration (`vitest.workspace.ts`). Each package has its own `vitest.config.ts`.

```bash
bun run test                                  # Run all tests
bunx vitest --project @autonoe/core           # Run tests for a specific package
bunx vitest packages/core/tests/session.test  # Run a single test file
```

## Conventions

- **Formatting**: Prettier with `semi: false`, `singleQuote: true`
- **Commits**: Conventional commits format
- **TypeScript**: Strict mode, ESNext target/module
- **Prompts**: Markdown files imported via `with { type: 'text' }` (requires `markdown.d.ts`)

## Security Model (Target Architecture)

The agent will operate under three security layers:

1. OS sandbox (SDK)
2. Filesystem scope limited to project directory
3. Bash allowlist via PreToolUse hook

`.autonoe/` directory is read-only for direct access; writes only via StatusTool.

## Implementation Status

The project is in early development. Core exports `runSession()` as a stub. Key components from SPEC.md pending implementation:

- AgentClient / MockAgentClient
- BashSecurity (PreToolUse hook)
- StatusTool
- Prompt system (initializer.md, coding.md)

## Specification

`SPEC.md` is the single source of truth for requirements, interfaces, and scenarios. Always consult it when implementing new features.
