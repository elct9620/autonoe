# Autonoe

Autonomous coding agent orchestrator powered by Claude's Agent SDK.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/elct9620/autonoe)
[![codecov](https://codecov.io/github/elct9620/autonoe/graph/badge.svg?token=A681DA03X2)](https://codecov.io/github/elct9620/autonoe)

## Inspiration

This project is inspired by:

- [Autonomous Coding Quickstart](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding) - Anthropic's example of building autonomous coding agents
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) - Best practices for orchestrating long-running AI agents

Autonoe builds on these concepts by adding:

- **Deliverable-based workflow** - Break work into verifiable units with acceptance criteria
- **Multi-language support** - Pre-configured profiles for Node.js, Python, Ruby, Go, Rust, and PHP
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
  cli:
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
docker compose run --rm cli autonoe run
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
| `rust`   | Rust toolchain with Playwright       |
| `php`    | PHP with Composer and Playwright     |

Example for a Python project:

```yaml
services:
  cli:
    image: ghcr.io/elct9620/autonoe/cli:python
    volumes:
      - .:/workspace
    working_dir: /workspace
    environment:
      CLAUDE_CODE_OAUTH_TOKEN: ${CLAUDE_CODE_OAUTH_TOKEN:-}
```

### Custom Image with Additional Tools

To extend language profiles with additional tools, use `dockerfile_inline` combined with `agent.json`.

**Example: Adding SQLite3 support**

1. Create `compose.yml` with inline Dockerfile:

```yaml
services:
  autonoe:
    build:
      context: .
      dockerfile_inline: |
        FROM ghcr.io/elct9620/autonoe/cli:python
        RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*
    volumes:
      - .:/workspace
    working_dir: /workspace
    environment:
      CLAUDE_CODE_OAUTH_TOKEN: ${CLAUDE_CODE_OAUTH_TOKEN:-}
```

2. Create `.autonoe/agent.json` to allow the new command:

```json
{
  "allowCommands": {
    "base": ["sqlite3"]
  }
}
```

3. Run with Docker Compose:

```bash
docker compose run --rm autonoe autonoe run
```

**Key points:**

- Use `dockerfile_inline` to install additional packages on top of language profiles
- Use `allowCommands.base` to permit the command for both `run` and `sync`
- Use `allowCommands.run` for commands only needed during implementation

**Advanced: SSH and Git configuration**

For workflows requiring Git operations with SSH authentication:

```yaml
services:
  autonoe:
    build:
      context: .
      dockerfile_inline: |
        FROM ghcr.io/elct9620/autonoe/cli:python
        RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*
    volumes:
      - .:/workspace
      - ./.gitconfig.container:/root/.gitconfig:ro
      - /run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock
    working_dir: /workspace
    environment:
      CLAUDE_CODE_OAUTH_TOKEN: ${CLAUDE_CODE_OAUTH_TOKEN:-}
      SSH_AUTH_SOCK: /run/host-services/ssh-auth.sock
```

This mounts the host's SSH agent socket (macOS Docker Desktop) and a custom `.gitconfig` for container use.

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

### Common Options

All commands share the following options:

| Option             | Short | Description                                      | Default |
| ------------------ | ----- | ------------------------------------------------ | ------- |
| `--project-dir`    | `-p`  | Project directory                                | cwd     |
| `--max-iterations` | `-n`  | Maximum coding sessions                          | -       |
| `--max-retries`    |       | Maximum retries on session error                 | 3       |
| `--model`          | `-m`  | Claude model for coding/verify sessions          | sonnet  |
| `--plan-model`     | `-pm` | Claude model for planning sessions               | opus    |
| `--debug`          | `-d`  | Show debug output                                | false   |
| `--wait-for-quota` |       | Wait for quota reset instead of exiting          | false   |
| `--thinking`       |       | Enable extended thinking mode (budget in tokens) | 8192    |

**Model Selection by Phase:**

| Phase          | Sessions          | Option         | Default |
| -------------- | ----------------- | -------------- | ------- |
| Planning       | initializer, sync | `--plan-model` | opus    |
| Implementation | coding, verify    | `--model`      | sonnet  |

### run Command

Implements deliverables from SPEC.md.

```bash
autonoe run [options]
```

**Additional Options:**

| Option                | Short | Description                           | Default |
| --------------------- | ----- | ------------------------------------- | ------- |
| `--no-sandbox`        |       | Disable SDK sandbox (not recommended) | false   |
| `--allow-destructive` | `-D`  | Enable rm/mv with path validation     | false   |

### sync Command

Synchronizes SPEC.md with status.json and verifies existing implementation.

```bash
autonoe sync [options]
```

Uses common options only. This is a **read-only operation** that does not modify project files (except `.autonoe/status.json` and `.autonoe-note.md`).

## How It Works

Autonoe provides two commands: `run` for implementation and `sync` for verification.

### run Command

Implements deliverables from SPEC.md in a session loop:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          run Session Loop                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐                  ┌──────────────────┐        │
│  │ Phase 1:         │                  │ Phase 2:         │        │
│  │ Initialization   │─────────────────▶│ Coding           │        │
│  │                  │                  │                  │        │
│  │ - Read SPEC.md   │  (status.json    │ - Implement      │        │
│  │ - Create         │   created)       │ - Test & Verify  │        │
│  │   deliverables   │                  │ - Mark status    │        │
│  └──────────────────┘                  └────────┬─────────┘        │
│                                                 │                   │
│                                                 ▼                   │
│                                  ┌──────────────────────────┐      │
│                                  │ All deliverables passed? │      │
│                                  └─────────────┬────────────┘      │
│                                       Yes      │      No           │
│                                        ▼       │       ▼           │
│                                      Done      │  ┌────────────┐   │
│                                                │  │ Continue?  │   │
│                                                │  └─────┬──────┘   │
│                                                │        │          │
│                                                │   Yes  │  No      │
│                                                │    ▼   │   ▼      │
│                                                │  Next  │  Exit    │
│                                                │ session│          │
│                                                └────────┘          │
└─────────────────────────────────────────────────────────────────────┘

Exit conditions: max iterations, all blocked, quota exceeded, max retries
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

### sync Command

Synchronizes SPEC.md changes and verifies existing implementation (**read-only**):

```
┌─────────────────────────────────────────────────────────────────────┐
│                         sync Session Loop                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐                  ┌──────────────────┐        │
│  │ Phase 1:         │                  │ Phase 2:         │        │
│  │ Sync             │─────────────────▶│ Verify           │        │
│  │                  │                  │                  │        │
│  │ - Read SPEC.md   │  (status.json    │ - Run tests      │        │
│  │ - Create/Update  │   updated)       │ - Validate code  │        │
│  │   deliverables   │                  │ - Mark verified  │        │
│  └──────────────────┘                  └────────┬─────────┘        │
│                                                 │                   │
│                                                 ▼                   │
│                                ┌────────────────────────────┐      │
│                                │ All deliverables verified? │      │
│                                └─────────────┬──────────────┘      │
│                                       Yes    │      No             │
│                                        ▼     │       ▼             │
│                                      Done    │   Continue          │
└─────────────────────────────────────────────────────────────────────┘

Does NOT modify project files (only .autonoe/status.json and .autonoe-note.md)
```

**Phase 1: Sync**

- Reads your `SPEC.md` file
- Creates new deliverables or marks removed ones as deprecated
- Updates `.autonoe/status.json`

**Phase 2: Verify**

- Runs tests and validation
- Confirms deliverable status matches implementation
- Marks each deliverable as verified

### Deliverable Status

Each deliverable tracks progress with three states:

| Status    | Meaning                                |
| --------- | -------------------------------------- |
| `pending` | Not yet completed                      |
| `passed`  | All acceptance criteria verified       |
| `blocked` | Cannot proceed (dependency/constraint) |

Deliverables removed from SPEC.md are marked with `deprecatedAt` timestamp and excluded from termination evaluation.

### Exit Conditions

| Condition             | run | sync |
| --------------------- | --- | ---- |
| All achievable passed | ✓   | -    |
| All verified          | -   | ✓    |
| All blocked           | ✓   | ✓    |
| Max iterations        | ✓   | ✓    |
| Max retries           | ✓   | ✓    |
| Quota exceeded        | ✓   | ✓    |

## Configuration

Create `.autonoe/agent.json` to customize behavior:

```json
{
  "profile": ["node", "python"],
  "allowCommands": {
    "base": ["make"],
    "run": ["docker", "custom-cli"],
    "sync": ["shellcheck"]
  },
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

| Field               | Type                         | Description                                |
| ------------------- | ---------------------------- | ------------------------------------------ |
| `profile`           | `string \| string[]`         | Language profiles to enable (default: all) |
| `allowCommands`     | `string[] \| TieredCommands` | Additional bash commands (see below)       |
| `allowPkillTargets` | `string[]`                   | Additional processes that can be killed    |
| `permissions.allow` | `string[]`                   | SDK permission rules                       |
| `allowedTools`      | `string[]`                   | Additional SDK tools to enable             |
| `mcpServers`        | `object`                     | Custom MCP servers                         |

### allowCommands Structure

Commands can be specified per-command or shared:

| Key    | Applies to   | Example                  |
| ------ | ------------ | ------------------------ |
| `base` | run and sync | `"base": ["make"]`       |
| `run`  | run only     | `"run": ["docker"]`      |
| `sync` | sync only    | `"sync": ["shellcheck"]` |

Legacy `string[]` format is treated as `{ run: [...] }` for backward compatibility.

### Language Profiles

| Profile  | Includes                                     |
| -------- | -------------------------------------------- |
| `node`   | node, npm, bun, yarn, pnpm, vite, next, etc. |
| `python` | python, pip, uv, pytest, django, flask, etc. |
| `ruby`   | ruby, gem, bundle, rails, rspec, etc.        |
| `go`     | go, gofmt, golangci-lint, etc.               |
| `rust`   | cargo, rustc, rustfmt, clippy, etc.          |
| `php`    | php, composer, phpunit, phpstan, etc.        |

## Custom Instructions

Override the default agent instructions by creating files in `.autonoe/`:

| File                      | Command | Purpose                                        |
| ------------------------- | ------- | ---------------------------------------------- |
| `.autonoe/initializer.md` | run     | First session: read SPEC, create deliverables  |
| `.autonoe/coding.md`      | run     | Subsequent sessions: implement and verify      |
| `.autonoe/sync.md`        | sync    | First session: parse SPEC, update deliverables |
| `.autonoe/verify.md`      | sync    | Subsequent sessions: validate implementation   |

### Instruction Selection

**`run` command:**

1. First session (no `.autonoe/status.json`): Uses `initializer.md`
2. Subsequent sessions: Uses `coding.md`

**`sync` command:**

1. First session: Uses `sync.md`
2. Subsequent sessions: Uses `verify.md`

### Override Priority

```
.autonoe/{name}.md  →  (if exists) use custom
                    →  (if not) use built-in default
```

### Example: Custom Initializer

```bash
mkdir -p .autonoe

cat > .autonoe/initializer.md << 'EOF'
# Custom Initialization

Your custom instructions here...

## Required Steps
1. Read SPEC.md
2. Create deliverables with acceptance criteria
...
EOF
```

Custom instructions completely replace the defaults (no merging).

### Agent Notes

The agent may create `.autonoe-note.md` to persist observations between sessions.
This file is auto-generated and should not be manually edited.

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

## Sandbox Limitations

The Claude Agent SDK sandbox has platform-specific limitations:

| Limitation                           | Workaround                                    |
| ------------------------------------ | --------------------------------------------- |
| macOS support unstable               | Use Docker                                    |
| Linux ARM64 browser install fails    | Disable sandbox, use `npx playwright install` |
| Cannot detect pre-installed browsers | Install browser at runtime via npx            |

### Docker (Recommended)

Docker images disable the sandbox by default (`AUTONOE_NO_SANDBOX=1`) for maximum compatibility. Browser automation works reliably across all platforms.

For browser automation, add to your `SPEC.md`:

```markdown
## Prerequisites

Before browser testing, install Chromium:
npx playwright install --with-deps chromium
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
make test-integration              # Run integration tests (requires Docker)
```

### Docker

```bash
# Build the CLI image
docker compose build

# Run CLI in container
docker compose run --rm cli autonoe run

# Build specific target (base, node, python, golang, ruby, rust, php)
docker build --target python -f apps/cli/Dockerfile .
```

### Cloud Image

Pre-built Ubuntu cloud images are available for KVM/QEMU environments:

| File                                        | Description |
| ------------------------------------------- | ----------- |
| `autonoe-{version}-ubuntu-24.04.img`        | Cloud Image |
| `autonoe-{version}-ubuntu-24.04.img.sha256` | Checksum    |

**Pre-installed:** Autonoe CLI, Git, curl, openssh-server

**Cloud-Init Support:** User creation, SSH key injection, hostname and network configuration

Download from [GitHub Releases](https://github.com/elct9620/autonoe/releases).

## License

[Apache License 2.0](LICENSE)
