# Autonoe

Autonomous coding agent orchestrator powered by Claude's Agent SDK.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Inspiration

This project is inspired by:

- [Autonomous Coding Quickstart](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding) - Anthropic's example of building autonomous coding agents
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) - Best practices for orchestrating long-running AI agents

Autonoe builds on these concepts by adding:

- **Deliverable-based workflow** - Break work into verifiable units with acceptance criteria
- **Multi-language support** - Pre-configured profiles for Node.js, Python, Ruby, and Go
- **Three-layer security** - SDK sandbox, filesystem scope, and command allowlists
- **Session iteration** - Automatic retry until all deliverables pass

## Quick Start

### Prerequisites

**Default (Recommended):** Uses your Claude Code subscription. Requires [Claude Code](https://claude.ai/code) to be installed and authenticated.

**Alternative:** Use an API key by setting `ANTHROPIC_API_KEY` environment variable. See [Claude Agent SDK documentation](https://github.com/anthropics/claude-agent-sdk) for details.

### Installation

#### Option 1: Pre-built Binary

Download the latest release from [GitHub Releases](https://github.com/elct9620/autonoe/releases):

| Platform    | File                          |
| ----------- | ----------------------------- |
| Linux x64   | `autonoe-linux-x64.tar.gz`    |
| Linux ARM64 | `autonoe-linux-arm64.tar.gz`  |
| macOS x64   | `autonoe-darwin-x64.tar.gz`   |
| macOS ARM64 | `autonoe-darwin-arm64.tar.gz` |
| Windows x64 | `autonoe-windows-x64.zip`     |

```bash
# Example for macOS ARM64
curl -LO https://github.com/elct9620/autonoe/releases/latest/download/autonoe-darwin-arm64.tar.gz
tar -xzf autonoe-darwin-arm64.tar.gz
sudo mv autonoe-darwin-arm64 /usr/local/bin/autonoe
```

#### Option 2: Docker (Recommended for macOS)

The SDK sandbox has known issues on macOS. Docker provides a reliable experience.

Create a `compose.yml` in your project:

```yaml
services:
  autonoe:
    image: ghcr.io/elct9620/autonoe/cli:node
    volumes:
      - .:/workspace
    working_dir: /workspace
    environment:
      CLAUDE_CODE_OAUTH_TOKEN: ${CLAUDE_CODE_OAUTH_TOKEN:-}
```

### Usage

1. Create a `SPEC.md` file in your project directory:

```markdown
# My Project

Build a simple CLI tool that prints "Hello, World!"
```

2. Run Autonoe:

```bash
# Using binary
autonoe run -p /path/to/your/project

# Using Docker
docker compose run --rm autonoe autonoe run
```

## Docker Options

### Language Profiles

Choose the image tag that matches your project's language:

| Tag      | Description                          |
| -------- | ------------------------------------ |
| `base`   | Minimal runtime (git, curl only)     |
| `node`   | Node.js with npm and Playwright      |
| `python` | Python with pip and Playwright       |
| `golang` | Go toolchain with Playwright         |
| `ruby`   | Ruby with gem/bundler and Playwright |

Example for a Python project:

```yaml
services:
  autonoe:
    image: ghcr.io/elct9620/autonoe/cli:python
    volumes:
      - .:/workspace
    working_dir: /workspace
    environment:
      CLAUDE_CODE_OAUTH_TOKEN: ${CLAUDE_CODE_OAUTH_TOKEN:-}
```

### Authentication

| Variable                  | Description                                  |
| ------------------------- | -------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code subscription token (recommended) |
| `ANTHROPIC_API_KEY`       | API key for direct billing                   |

Create a `.env` file (Docker Compose loads it automatically):

```bash
CLAUDE_CODE_OAUTH_TOKEN=your-oauth-token
```

## CLI Reference

```
autonoe run [options]

Options:
  -p, --project-dir <path>    Project directory (default: current directory)
  -n, --max-iterations <n>    Maximum coding sessions (default: unlimited)
  -m, --model <model>         Claude model to use
  -d, --debug                 Show debug output
  --no-sandbox                Disable SDK sandbox (not recommended)
  -h, --help                  Show help
  -v, --version               Show version
```

## How It Works

Autonoe operates in two phases:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Session Loop                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  Phase 1:        │         │  Phase 2:        │              │
│  │  Initialization  │────────▶│  Coding          │              │
│  │                  │         │                  │              │
│  │  - Read SPEC.md  │         │  - Implement     │              │
│  │  - Create        │         │  - Test          │              │
│  │    deliverables  │         │  - Verify        │              │
│  └──────────────────┘         └────────┬─────────┘              │
│                                        │                         │
│                                        ▼                         │
│                               ┌──────────────────┐              │
│                               │ All deliverables │──Yes──▶ Done │
│                               │ passed?          │              │
│                               └────────┬─────────┘              │
│                                        │ No                      │
│                                        └───────────────┐        │
│                                                        │        │
│                                        ┌───────────────┘        │
│                                        ▼                         │
│                               ┌──────────────────┐              │
│                               │ Max iterations?  │──Yes──▶ Exit │
│                               └────────┬─────────┘              │
│                                        │ No                      │
│                                        └──────▶ Next session    │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 1: Initialization**

- Reads your `SPEC.md` file
- Creates deliverables with acceptance criteria
- Stores status in `.autonoe/status.json`

**Phase 2: Coding**

- Implements each deliverable
- Runs tests and verification
- Marks deliverables as passed/failed
- Continues until all deliverables pass or max iterations reached

## Configuration

Create `.autonoe/agent.json` to customize behavior:

```json
{
  "profile": ["node", "python"],
  "allowCommands": ["docker", "custom-cli"],
  "allowPkillTargets": ["custom-server"],
  "permissions": {
    "allow": ["WebFetch(https://api.example.com/*)"]
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

### Configuration Options

| Field               | Type                 | Description                                |
| ------------------- | -------------------- | ------------------------------------------ |
| `profile`           | `string \| string[]` | Language profiles to enable (default: all) |
| `allowCommands`     | `string[]`           | Additional bash commands to allow          |
| `allowPkillTargets` | `string[]`           | Additional processes that can be killed    |
| `permissions.allow` | `string[]`           | SDK permission rules                       |
| `allowedTools`      | `string[]`           | Additional SDK tools to enable             |
| `mcpServers`        | `object`             | Custom MCP servers                         |

### Language Profiles

| Profile  | Includes                                     |
| -------- | -------------------------------------------- |
| `node`   | node, npm, bun, yarn, pnpm, vite, next, etc. |
| `python` | python, pip, uv, pytest, django, flask, etc. |
| `ruby`   | ruby, gem, bundle, rails, rspec, etc.        |
| `go`     | go, gofmt, golangci-lint, etc.               |

## Security Model

Autonoe implements three layers of security:

```
┌─────────────────────────────────────────────────────┐
│              Security Layers                         │
├─────────────────────────────────────────────────────┤
│  Layer 1: SDK Sandbox                               │
│  ├── OS-level process isolation                     │
│  └── Filesystem/network containment                 │
├─────────────────────────────────────────────────────┤
│  Layer 2: Filesystem Scope                          │
│  └── Read/Write limited to project directory        │
├─────────────────────────────────────────────────────┤
│  Layer 3: PreToolUse Hooks                          │
│  ├── BashSecurity: Command allowlist                │
│  └── AutonoeProtection: Block writes to .autonoe/   │
└─────────────────────────────────────────────────────┘
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/cli (Presentation)                                        │
│    CLI commands, argument parsing, output formatting            │
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

| Package          | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `@autonoe/cli`   | Entry point, CLI argument parsing                                |
| `@autonoe/core`  | Domain types, session orchestration (zero external dependencies) |
| `@autonoe/agent` | Claude Agent SDK wrapper                                         |

## Development

### Commands

```bash
bun run check          # Type checking
bun run format         # Format code with Prettier
bun run compile        # Compile to single executable
```

### Testing

```bash
bun run test                       # Run all tests
bun run test --project core        # Run core package tests
bun run test --project agent       # Run agent package tests
bun run test --coverage            # Run with coverage report
```

### Docker

```bash
# Build the CLI image
docker compose build

# Run CLI in container
docker compose run --rm cli autonoe run

# Build specific target (base, node, python, golang, ruby)
docker build --target python -f apps/cli/Dockerfile .
```

## License

[Apache License 2.0](LICENSE)
