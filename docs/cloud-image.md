# Cloud Image Configuration

Cloud image configuration for Autonoe CLI. For overview, see [SPEC.md Section 7.3](../SPEC.md#73-cloud-image).

## Build Strategy

Autonoe Cloud Image is built by modifying Ubuntu Cloud Image directly using libguestfs, avoiding the need for KVM hardware virtualization.

```text
Ubuntu Cloud Image (.img)
        │
        ▼
┌─────────────────────────────────┐
│  virt-customize (libguestfs)    │
│  LIBGUESTFS_BACKEND=direct      │
│  LIBGUESTFS_BACKEND_SETTINGS=   │
│    force_tcg                    │
├─────────────────────────────────┤
│  1. Copy autonoe binary         │
│  2. Set executable permissions  │
└─────────────────────────────────┘
        │
        ▼
autonoe-ubuntu-24.04.img
```

## Source Image

| Attribute    | Value                                          |
| ------------ | ---------------------------------------------- |
| Source       | https://cloud-images.ubuntu.com/noble/current/ |
| File         | `noble-server-cloudimg-amd64.img`              |
| Architecture | amd64 (x86_64)                                 |

## Build Environment

| Component        | Source                   | Purpose                       |
| ---------------- | ------------------------ | ----------------------------- |
| libguestfs-tools | Ubuntu official package  | Image modification toolkit    |
| virt-customize   | Part of libguestfs-tools | Inject files and run commands |

**Environment Variables:**

| Variable                      | Value       | Purpose                                  |
| ----------------------------- | ----------- | ---------------------------------------- |
| `LIBGUESTFS_BACKEND`          | `direct`    | Bypass libvirt, use QEMU directly        |
| `LIBGUESTFS_BACKEND_SETTINGS` | `force_tcg` | Use software emulation (no KVM required) |

## Build Commands

```bash
# Install libguestfs-tools
sudo apt-get update
sudo apt-get install -y libguestfs-tools

# Download Ubuntu Cloud Image
curl -LO https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img

# Copy to output name
cp noble-server-cloudimg-amd64.img autonoe-ubuntu-24.04.img

# Customize image
export LIBGUESTFS_BACKEND=direct
export LIBGUESTFS_BACKEND_SETTINGS=force_tcg

sudo virt-customize --no-network -a autonoe-ubuntu-24.04.img \
  --copy-in /path/to/autonoe:/usr/local/bin \
  --chmod 0755:/usr/local/bin/autonoe
```

**Command Options:**

| Option         | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `sudo`         | Required to read `/boot/vmlinuz-*` for supermin appliance |
| `--no-network` | Disable network to avoid passt errors in CI environment   |

## Image Contents

### File Layout

| Path                     | Description        |
| ------------------------ | ------------------ |
| `/usr/local/bin/autonoe` | Autonoe CLI binary |

### Preserved from Ubuntu Cloud Image

| Component         | Description                |
| ----------------- | -------------------------- |
| cloud-init        | First-boot configuration   |
| openssh-server    | Remote access              |
| Standard packages | git, curl, ca-certificates |

## Usage

### First Boot Configuration

The image uses cloud-init for first-boot configuration. Provide user-data via:

- NoCloud datasource (ISO/vfat with CIDATA label)
- Cloud provider metadata service
- Kernel command line parameters

**Example user-data (cloud-config):**

```yaml
#cloud-config
users:
  - name: developer
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - ssh-rsa AAAA...

packages:
  - nodejs
  - npm
```

### Running with QEMU

```bash
# Create seed ISO for cloud-init
cloud-localds seed.iso user-data.yaml

# Boot the image
qemu-system-x86_64 \
  -m 2048 \
  -drive file=autonoe-ubuntu-24.04.img,format=raw \
  -drive file=seed.iso,format=raw \
  -nographic
```

## References

- [libguestfs](https://libguestfs.org/) - Library for accessing and modifying VM disk images
- [virt-customize](https://libguestfs.org/virt-customize.1.html) - Customize virtual machine images
- [Ubuntu Cloud Images](https://cloud-images.ubuntu.com/) - Official Ubuntu cloud images
- [cloud-init](https://cloud-init.io/) - Cloud instance initialization
