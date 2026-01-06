/**
 * Profile command sets and related data
 * @see SPEC.md Section 6.3.2
 */

import type { ProfileName } from './types'

/**
 * Base profile commands (always included)
 * @see SPEC.md Section 6.3.2
 */
export const BASE_COMMANDS = new Set([
  // Navigation
  'ls',
  'pwd',
  'cat',
  'head',
  'tail',
  'wc',
  'find',
  'grep',
  // File Ops
  'mkdir',
  'cp',
  // Git
  'git',
  // Process
  'echo',
  'which',
  'ps',
  'lsof',
  'sleep',
  // Text Processing
  'tree',
  'sort',
  'diff',
  'printf',
  'date',
  'uniq',
  'cut',
  'tr',
  'tac',
  'jq',
])

/**
 * Node.js profile commands
 * @see SPEC.md Section 6.3.2
 */
export const NODE_COMMANDS = new Set([
  // Runtime
  'node',
  'bun',
  'deno',
  // Package
  'npm',
  'npx',
  'yarn',
  'pnpm',
  // Build
  'tsc',
  'esbuild',
  'vite',
  'webpack',
  'rollup',
  // Test
  'jest',
  'vitest',
  'playwright',
  'mocha',
  // Lint
  'eslint',
  'prettier',
  'biome',
  // Framework
  'next',
  'nuxt',
  'astro',
  'remix',
])

/**
 * Python profile commands
 * @see SPEC.md Section 6.3.2
 */
export const PYTHON_COMMANDS = new Set([
  // Runtime
  'python',
  'python3',
  // Package
  'pip',
  'pip3',
  'pipx',
  'uv',
  // Venv
  'venv',
  'virtualenv',
  'conda',
  // Build
  'poetry',
  'pdm',
  'hatch',
  'flit',
  // Test
  'pytest',
  'tox',
  'nox',
  // Lint
  'ruff',
  'black',
  'mypy',
  'flake8',
  'pylint',
  // Framework
  'django-admin',
  'flask',
  'uvicorn',
  'gunicorn',
])

/**
 * Ruby profile commands
 * @see SPEC.md Section 6.3.2
 */
export const RUBY_COMMANDS = new Set([
  // Runtime
  'ruby',
  'irb',
  // Package
  'gem',
  'bundle',
  'bundler',
  // Build
  'rake',
  'thor',
  // Test
  'rspec',
  'minitest',
  'cucumber',
  // Lint
  'rubocop',
  'standard',
  // Framework
  'rails',
  'hanami',
  'puma',
  'unicorn',
])

/**
 * Go profile commands
 * @see SPEC.md Section 6.3.2
 */
export const GO_COMMANDS = new Set([
  // Runtime
  'go',
  // Format
  'gofmt',
  'goimports',
  // Lint
  'golint',
  'golangci-lint',
  'staticcheck',
  // Tools
  'gopls',
  'dlv',
  'goreleaser',
])

/**
 * Profile to commands mapping
 */
export const PROFILE_COMMANDS: Record<ProfileName, Set<string>> = {
  base: BASE_COMMANDS,
  node: NODE_COMMANDS,
  python: PYTHON_COMMANDS,
  ruby: RUBY_COMMANDS,
  go: GO_COMMANDS,
}

/**
 * Commands requiring argument validation (always enabled)
 */
export const VALIDATED_COMMANDS = new Set(['chmod', 'pkill'])

/**
 * Destructive commands that require special validation
 * Only enabled when --allow-destructive flag is set
 * @see SPEC.md Section 6.4.2
 */
export const DESTRUCTIVE_COMMANDS = new Set(['rm', 'mv'])

/**
 * Blocked flags for destructive commands
 * @see SPEC.md Section 6.4.4
 */
export const BLOCKED_RM_FLAGS = new Set(['--no-preserve-root'])

/**
 * pkill targets per profile
 * @see SPEC.md Section 6.3.3
 */
export const NODE_PKILL_TARGETS = new Set([
  'node',
  'npm',
  'npx',
  'vite',
  'next',
])
export const PYTHON_PKILL_TARGETS = new Set([
  'python',
  'python3',
  'uvicorn',
  'gunicorn',
])
export const RUBY_PKILL_TARGETS = new Set(['ruby', 'puma', 'unicorn', 'rails'])
export const GO_PKILL_TARGETS = new Set(['go'])

/**
 * Profile to pkill targets mapping
 */
export const PROFILE_PKILL_TARGETS: Record<ProfileName, Set<string>> = {
  base: new Set(),
  node: NODE_PKILL_TARGETS,
  python: PYTHON_PKILL_TARGETS,
  ruby: RUBY_PKILL_TARGETS,
  go: GO_PKILL_TARGETS,
}

/**
 * Pattern for allowed chmod modes (+x variants)
 */
export const CHMOD_ALLOWED_MODE_PATTERN = /^[ugoa]*\+x$/
