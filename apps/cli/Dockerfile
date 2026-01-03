# syntax=docker/dockerfile:1

# Build arguments
ARG NODE_VERSION=24
ARG PYTHON_VERSION=3.14
ARG GOLANG_VERSION=1.25
ARG RUBY_VERSION=4.0

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

# Install essential tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binary
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

WORKDIR /workspace

CMD ["autonoe"]

# =============================================================================
# Node.js Stage
# =============================================================================
FROM node:${NODE_VERSION}-bookworm-slim AS node

# Install essential tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binary
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Install Playwright system dependencies (browser installed via npx at runtime)
RUN npx playwright install-deps chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/tmp/playwright-browsers

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

CMD ["autonoe"]

# =============================================================================
# Python Stage
# =============================================================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS python

ARG NODE_VERSION

# Install essential tools and Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Copy compiled binary
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Install Playwright system dependencies (browser installed via npx at runtime)
RUN npx playwright install-deps chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/tmp/playwright-browsers

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

CMD ["autonoe"]

# =============================================================================
# Golang Stage
# =============================================================================
FROM golang:${GOLANG_VERSION}-bookworm AS golang

ARG NODE_VERSION

# Install essential tools and Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binary
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Install Playwright system dependencies (browser installed via npx at runtime)
RUN npx playwright install-deps chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/tmp/playwright-browsers

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

CMD ["autonoe"]

# =============================================================================
# Ruby Stage
# =============================================================================
FROM ruby:${RUBY_VERSION}-slim-bookworm AS ruby

ARG NODE_VERSION

# Install essential tools and Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binary
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Install Playwright system dependencies (browser installed via npx at runtime)
RUN npx playwright install-deps chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/tmp/playwright-browsers

# Disable SDK sandbox for Docker compatibility (Linux ARM64, pre-installed browser detection)
ENV AUTONOE_NO_SANDBOX=1

WORKDIR /workspace

CMD ["autonoe"]

