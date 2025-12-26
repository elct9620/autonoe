# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Type checking
bun run check

# Format code
bun run format

# Compile to single executable
bun run compile

# Run tests (when implemented)
bun run test

# Run the CLI directly
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

- `@autonoe/cli` - Entry point, argument parsing with CAC
- `@autonoe/core` - Session orchestration, AgentClient, BashSecurity, StatusTool, prompts

### Configuration Sources (merge order)

1. Hardcoded defaults (sandbox, built-in MCP servers)
2. Security baseline (always enforced)
3. User config (`.autonoe/agent.json`) - merged, cannot override security

## Conventions

- **Formatting**: Prettier with `semi: false`, `singleQuote: true`
- **Commits**: Conventional commits format
- **TypeScript**: Strict mode, ESNext target/module
- **Prompts**: Markdown files imported via `with { type: 'text' }`

## Security Model

The agent operates under three security layers:
1. OS sandbox (SDK)
2. Filesystem scope limited to project directory
3. Bash allowlist via PreToolUse hook

`.autonoe/` directory is read-only for direct access; writes only via StatusTool.

## Specification

`SPEC.md` is the single source of truth for requirements, interfaces, and scenarios. It defines the complete system architecture and expected behavior.
