# Docker Configuration

Docker image configuration for Autonoe CLI. For overview, see [SPEC.md Section 7](../SPEC.md#7-build--distribution-design).

## Image Strategy

Each publishable package maps to a separate image path under the organization namespace:

| Package  | Image Path                  | Description      |
| -------- | --------------------------- | ---------------- |
| apps/cli | `ghcr.io/[org]/autonoe/cli` | Coding Agent CLI |

## Registry

| Setting      | Value                             |
| ------------ | --------------------------------- |
| Registry     | GitHub Container Registry         |
| Path Pattern | `ghcr.io/[org]/autonoe/<package>` |
| Default Tag  | `:latest` = `:base`               |

## Build Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Dockerfile                          │
├─────────────────────────────────────────────────────────┤
│  builder ──▶ Compile autonoe binary                     │
│      │                                                  │
│      ├──▶ base (debian:bookworm-slim)                   │
│      ├──▶ node (node:XX-bookworm-slim)                  │
│      ├──▶ python (python:X.XX-slim-bookworm)            │
│      ├──▶ golang (golang:X.XX-bookworm)                 │
│      ├──▶ ruby (ruby:X.X-slim-bookworm)                 │
│      ├──▶ rust (rust:X.XX-slim-bookworm)                │
│      └──▶ php (php:X.X-cli-bookworm)                    │
└─────────────────────────────────────────────────────────┘
```

## Targets and Tags

| Target | Base Image                | Tag                | Tools                                                                     | Use Case               |
| ------ | ------------------------- | ------------------ | ------------------------------------------------------------------------- | ---------------------- |
| base   | debian:bookworm-slim      | `:latest`, `:base` | git, curl, ca-certificates, openssh-client, gnupg                         | Minimal runtime        |
| node   | node:XX-bookworm-slim     | `:node`            | git, curl, openssh-client, gnupg, npm, Playwright deps                    | Frontend development   |
| python | python:X.XX-slim-bookworm | `:python`          | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps, pip, uv  | Backend / Data science |
| golang | golang:X.XX-bookworm      | `:golang`          | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps           | System programming     |
| ruby   | ruby:X.X-slim-bookworm    | `:ruby`            | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps, Bundler  | Web development        |
| rust   | rust:X.XX-slim-bookworm   | `:rust`            | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps, cargo    | Systems programming    |
| php    | php:X.X-cli-bookworm      | `:php`             | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps, composer | Web development        |

Each target must include base tools (git, curl, ca-certificates, openssh-client, gnupg) for Claude Code and Git signing to function properly.

## Tag Naming Convention

| Pattern            | Example            | Description                                |
| ------------------ | ------------------ | ------------------------------------------ |
| `:base`            | `:base`            | Minimal runtime (no language tools)        |
| `:<lang>`          | `:node`, `:python` | Language runtime with Node.js + Playwright |
| `:X.Y.Z-<variant>` | `:1.0.0-node`      | Versioned tag                              |

## Build Args

| Arg              | Default          | Description   |
| ---------------- | ---------------- | ------------- |
| `NODE_VERSION`   | (see Dockerfile) | Node.js LTS   |
| `PYTHON_VERSION` | (see Dockerfile) | Python stable |
| `GOLANG_VERSION` | (see Dockerfile) | Go stable     |
| `RUBY_VERSION`   | (see Dockerfile) | Ruby stable   |
| `RUST_VERSION`   | (see Dockerfile) | Rust stable   |
| `PHP_VERSION`    | (see Dockerfile) | PHP stable    |

## Version Support Policy

| Language | Policy         |
| -------- | -------------- |
| Node.js  | Current LTS    |
| Python   | Current stable |
| Golang   | Current stable |
| Ruby     | Current stable |
| Rust     | Current stable |
| PHP      | Current stable |

**Version Updates**:

- Default versions follow official LTS/stable releases
- Users can specify versions via Build Args for custom builds

For CI/CD workflow configuration, see [CI/CD Workflows](ci-cd.md).
