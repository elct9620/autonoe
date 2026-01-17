# CI/CD Workflows

CI/CD workflow configuration for Autonoe. For distribution overview, see [SPEC.md Section 7](../SPEC.md#7-build--distribution-design).

## Workflow Structure

| Workflow             | Trigger      | Purpose                                                  |
| -------------------- | ------------ | -------------------------------------------------------- |
| `ci.yml`             | Push to main | Docker latest + Bun snapshot binaries                    |
| `release-please.yml` | Push to main | Release Please + versioned Docker + binary + cloud image |

## Reusable Workflows

| Component         | Location                                  | Purpose                              |
| ----------------- | ----------------------------------------- | ------------------------------------ |
| Docker builds     | `.github/workflows/build-docker.yml`      | Job-level reuse with matrix strategy |
| Binary builds     | `.github/workflows/build-binaries.yml`    | Job-level reuse with matrix strategy |
| Cloud Image build | `.github/workflows/build-cloud-image.yml` | Ubuntu Cloud Image with Autonoe CLI  |

---

## build-docker.yml

Builds multi-platform Docker images for all language targets.

### Inputs

| Input          | Type   | Required | Description                             |
| -------------- | ------ | -------- | --------------------------------------- |
| `tag-strategy` | string | Yes      | `latest` or `semver`                    |
| `version-tag`  | string | No       | Version tag for semver (e.g., `v1.0.0`) |

### Matrix

| Target | Platforms                |
| ------ | ------------------------ |
| base   | linux/amd64, linux/arm64 |
| node   | linux/amd64, linux/arm64 |
| python | linux/amd64, linux/arm64 |
| golang | linux/amd64, linux/arm64 |
| ruby   | linux/amd64, linux/arm64 |
| rust   | linux/amd64, linux/arm64 |
| php    | linux/amd64, linux/arm64 |

---

## build-binaries.yml

Builds cross-platform CLI binaries using Bun.

### Inputs

| Input          | Type   | Required | Description                              |
| -------------- | ------ | -------- | ---------------------------------------- |
| `tag-strategy` | string | Yes      | `snapshot` or `release`                  |
| `version-tag`  | string | No       | Version tag for release (e.g., `v1.0.0`) |

### Matrix

| Target       | Archive Format |
| ------------ | -------------- |
| linux-x64    | .tar.gz        |
| linux-arm64  | .tar.gz        |
| darwin-x64   | .tar.gz        |
| darwin-arm64 | .tar.gz        |
| windows-x64  | .zip           |

---

## build-cloud-image.yml

Builds Ubuntu Cloud Image with Autonoe CLI pre-installed.

### Inputs

| Input          | Type   | Required | Description                              |
| -------------- | ------ | -------- | ---------------------------------------- |
| `tag-strategy` | string | Yes      | `snapshot` or `release`                  |
| `version-tag`  | string | No       | Version tag for release (e.g., `v1.0.0`) |

### Build Process

1. Build Autonoe CLI binary (linux-x64)
2. Install libguestfs-tools from Ubuntu package repository
3. Download Ubuntu Cloud Image
4. Use `sudo virt-customize --no-network` to inject binary
5. Generate SHA256 checksum (release only)

**Required Options:**

| Option         | Purpose                                       |
| -------------- | --------------------------------------------- |
| `sudo`         | Read `/boot/vmlinuz-*` for supermin appliance |
| `--no-network` | Avoid passt network errors in CI              |

### Environment

| Variable                      | Value       | Purpose                                  |
| ----------------------------- | ----------- | ---------------------------------------- |
| `LIBGUESTFS_BACKEND`          | `direct`    | Bypass libvirt, use QEMU directly        |
| `LIBGUESTFS_BACKEND_SETTINGS` | `force_tcg` | Use software emulation (no KVM required) |

---

## Artifact Strategy

| Strategy | Artifacts                      | Retention | Checksums                  |
| -------- | ------------------------------ | --------- | -------------------------- |
| snapshot | Per-platform (binary-{target}) | 7 days    | None                       |
| release  | Per-platform (binary-{target}) | 90 days   | Per-platform .sha256 files |

## Release Assets

```
# Binaries
autonoe-linux-x64.tar.gz
autonoe-linux-x64.tar.gz.sha256
autonoe-linux-arm64.tar.gz
autonoe-linux-arm64.tar.gz.sha256
autonoe-darwin-x64.tar.gz
autonoe-darwin-x64.tar.gz.sha256
autonoe-darwin-arm64.tar.gz
autonoe-darwin-arm64.tar.gz.sha256
autonoe-windows-x64.zip
autonoe-windows-x64.zip.sha256

# Cloud Image
autonoe-{version}-ubuntu-24.04.img
autonoe-{version}-ubuntu-24.04.img.sha256
```
