# syntax=docker/dockerfile:1

# Build arguments
ARG NODE_VERSION=22
ARG PYTHON_VERSION=3.12
ARG GOLANG_VERSION=1.23
ARG RUBY_VERSION=3.3

# =============================================================================
# Builder Stage: Compile autonoe binary
# =============================================================================
FROM --platform=$BUILDPLATFORM oven/bun:debian AS builder

ARG TARGETPLATFORM

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/claude-agent-client/package.json packages/claude-agent-client/
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
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binary
COPY --from=builder /app/dist/autonoe /usr/local/bin/autonoe

WORKDIR /workspace

CMD ["autonoe"]

# =============================================================================
# Node.js Stage
# =============================================================================
FROM base AS node

ARG NODE_VERSION

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install claude-code CLI (required by claude-agent-sdk)
RUN npm install -g @anthropic-ai/claude-code

# Install Playwright dependencies
RUN npx playwright install-deps chromium

CMD ["autonoe"]

# =============================================================================
# Python Stage
# =============================================================================
FROM base AS python

ARG PYTHON_VERSION

# Install Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

CMD ["autonoe"]

# =============================================================================
# Golang Stage
# =============================================================================
FROM base AS golang

ARG GOLANG_VERSION

# Install Go
RUN curl -fsSL https://go.dev/dl/go${GOLANG_VERSION}.linux-amd64.tar.gz | tar -C /usr/local -xzf - \
    && ln -sf /usr/local/go/bin/go /usr/local/bin/go \
    && ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt

ENV GOPATH=/go
ENV PATH=$PATH:/usr/local/go/bin:$GOPATH/bin

CMD ["autonoe"]

# =============================================================================
# Ruby Stage
# =============================================================================
FROM base AS ruby

ARG RUBY_VERSION

# Install Ruby and Bundler
RUN apt-get update && apt-get install -y --no-install-recommends \
    ruby \
    ruby-bundler \
    && rm -rf /var/lib/apt/lists/*

CMD ["autonoe"]

# =============================================================================
# Node + Python Stage
# =============================================================================
FROM node AS node-python

ARG PYTHON_VERSION

# Install Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

CMD ["autonoe"]

# =============================================================================
# Node + Golang Stage
# =============================================================================
FROM node AS node-golang

ARG GOLANG_VERSION

# Install Go
RUN curl -fsSL https://go.dev/dl/go${GOLANG_VERSION}.linux-amd64.tar.gz | tar -C /usr/local -xzf - \
    && ln -sf /usr/local/go/bin/go /usr/local/bin/go \
    && ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt

ENV GOPATH=/go
ENV PATH=$PATH:/usr/local/go/bin:$GOPATH/bin

CMD ["autonoe"]

# =============================================================================
# Node + Ruby Stage
# =============================================================================
FROM node AS node-ruby

ARG RUBY_VERSION

# Install Ruby and Bundler
RUN apt-get update && apt-get install -y --no-install-recommends \
    ruby \
    ruby-bundler \
    && rm -rf /var/lib/apt/lists/*

CMD ["autonoe"]
