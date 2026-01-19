# syntax=docker/dockerfile:1

# Build arguments
ARG NODE_VERSION=24
ARG BUN_VERSION=1.3
ARG PYTHON_VERSION=3.14
ARG GOLANG_VERSION=1.25
ARG RUBY_VERSION=4.0
ARG RUST_VERSION=1.84
ARG PHP_VERSION=8.5

# =============================================================================
# Builder Stage: Compile autonoe binary
# =============================================================================
FROM --platform=$BUILDPLATFORM oven/bun:debian AS builder

ARG TARGETPLATFORM

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/agent/package.json packages/agent/
COPY apps/cli/package.json apps/cli/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY apps/ apps/
COPY tsconfig.json ./

# Compile to single executable for target platform
RUN case "$TARGETPLATFORM" in \
      "linux/amd64") BUN_TARGET="bun-linux-x64-baseline" ;; \
      "linux/arm64") BUN_TARGET="bun-linux-arm64" ;; \
      *) BUN_TARGET="bun-linux-x64-baseline" ;; \
    esac && \
    bun build apps/cli/bin/autonoe.ts --compile --target=$BUN_TARGET --outfile dist/autonoe

# =============================================================================
# Base Stage: Minimal runtime
# =============================================================================
FROM debian:bookworm-slim AS base

# Install essential tools (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]

# =============================================================================
# Node.js Stage
# =============================================================================
FROM node:${NODE_VERSION}-bookworm-slim AS node

# Install essential tools (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]

# =============================================================================
# Bun Stage
# =============================================================================
FROM oven/bun:${BUN_VERSION}-slim AS bun

ARG NODE_VERSION

# Install essential tools (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Disable SDK sandbox for Docker compatibility
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]

# =============================================================================
# Python Stage
# =============================================================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS python

ARG NODE_VERSION

# Install essential tools and Node.js (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]

# =============================================================================
# Golang Stage
# =============================================================================
FROM golang:${GOLANG_VERSION}-bookworm AS golang

ARG NODE_VERSION

# Install essential tools and Node.js (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]

# =============================================================================
# Ruby Stage
# =============================================================================
FROM ruby:${RUBY_VERSION}-slim-bookworm AS ruby

ARG NODE_VERSION

# Install essential tools and Node.js (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]

# =============================================================================
# Rust Stage
# =============================================================================
FROM rust:${RUST_VERSION}-slim-bookworm AS rust

ARG NODE_VERSION

# Install essential tools and Node.js (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]

# =============================================================================
# PHP Stage
# =============================================================================
FROM php:${PHP_VERSION}-cli-bookworm AS php

ARG NODE_VERSION

# Install essential tools and Node.js (including Git signing support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    openssh-client \
    gnupg \
    unzip \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

# Copy compiled binary (last to maximize cache hits)
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

CMD ["autonoe"]
