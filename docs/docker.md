# Docker Configuration

Docker image configuration for Autonoe CLI. For overview, see [SPEC.md Section 10](../SPEC.md#10-build--distribution-design).

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
│      └──▶ ruby (ruby:X.X-slim-bookworm)                 │
└─────────────────────────────────────────────────────────┘
```

## Targets and Tags

| Target | Base Image                | Tag                | Tools                                                                    | Use Case               |
| ------ | ------------------------- | ------------------ | ------------------------------------------------------------------------ | ---------------------- |
| base   | debian:bookworm-slim      | `:latest`, `:base` | git, curl, ca-certificates, openssh-client, gnupg                        | Minimal runtime        |
| node   | node:XX-bookworm-slim     | `:node`            | git, curl, openssh-client, gnupg, npm, Playwright deps                   | Frontend development   |
| python | python:X.XX-slim-bookworm | `:python`          | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps, pip, uv | Backend / Data science |
| golang | golang:X.XX-bookworm      | `:golang`          | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps          | System programming     |
| ruby   | ruby:X.X-slim-bookworm    | `:ruby`            | git, curl, openssh-client, gnupg, Node.js, npm, Playwright deps, Bundler | Web development        |

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

## Version Support Policy

| Language | Policy         |
| -------- | -------------- |
| Node.js  | Current LTS    |
| Python   | Current stable |
| Golang   | Current stable |
| Ruby     | Current stable |

**Version Updates**:

- Default versions follow official LTS/stable releases
- Users can specify versions via Build Args for custom builds

---

## CI/CD Workflows

### Workflow Structure

| Workflow             | Trigger      | Purpose                                            |
| -------------------- | ------------ | -------------------------------------------------- |
| `ci.yml`             | Push to main | Docker latest + Bun snapshot binaries              |
| `release-please.yml` | Push to main | Release Please + versioned Docker + binary release |

### Reusable Workflows

| Component     | Location                               | Purpose                              |
| ------------- | -------------------------------------- | ------------------------------------ |
| Docker builds | `.github/workflows/build-docker.yml`   | Job-level reuse with matrix strategy |
| Binary builds | `.github/workflows/build-binaries.yml` | Job-level reuse with matrix strategy |

### build-docker.yml Inputs

| Input          | Type   | Required | Description                             |
| -------------- | ------ | -------- | --------------------------------------- |
| `tag-strategy` | string | Yes      | `latest` or `semver`                    |
| `version-tag`  | string | No       | Version tag for semver (e.g., `v1.0.0`) |

### build-binaries.yml Inputs

| Input          | Type   | Required | Description                              |
| -------------- | ------ | -------- | ---------------------------------------- |
| `tag-strategy` | string | Yes      | `snapshot` or `release`                  |
| `version-tag`  | string | No       | Version tag for release (e.g., `v1.0.0`) |

### Artifact Strategy

| Strategy | Artifacts                      | Retention | Checksums                  |
| -------- | ------------------------------ | --------- | -------------------------- |
| snapshot | Per-platform (binary-{target}) | 7 days    | None                       |
| release  | Per-platform (binary-{target}) | 90 days   | Per-platform .sha256 files |

### Release Assets Example

```
autonoe-linux-x64.tar.gz
autonoe-linux-x64.tar.gz.sha256
autonoe-darwin-arm64.tar.gz
autonoe-darwin-arm64.tar.gz.sha256
...
```
