/**
 * Profile command sets with layer support
 * @see SPEC.md Section 5.4, 6.4
 */

import type { ProfileName, ProfileCommandSet } from './types'

// =============================================================================
// Base Profile
// =============================================================================

/**
 * Base status commands (verification layer)
 * Read-only commands available in all modes including sync
 * @see SPEC.md Section 6.2
 */
export const BASE_STATUS_COMMANDS = new Set([
  // Navigation
  'ls',
  'pwd',
  'cat',
  'head',
  'tail',
  'wc',
  'find',
  'grep',
  // Text Processing
  'tree',
  'sort',
  'diff',
  'date',
  // Git (sync needs to read version state)
  'git',
  // Utility (safe, no state modification)
  'echo',
  'sleep',
])

/**
 * Base operation commands (development layer only)
 * Commands that may modify state, only available in run mode
 * @see SPEC.md Section 6.2
 */
export const BASE_OPERATION_COMMANDS = new Set([
  // File Ops
  'mkdir',
  'cp',
  // Process
  'which',
  'ps',
  'lsof',
  // Text Processing
  'printf',
  'uniq',
  'cut',
  'tr',
  'tac',
  'jq',
])

/**
 * All base commands (status + operations)
 */
export const BASE_COMMANDS = new Set([
  ...BASE_STATUS_COMMANDS,
  ...BASE_OPERATION_COMMANDS,
])

// =============================================================================
// Node.js Profile
// =============================================================================

/**
 * Node.js verification commands (sync mode)
 * Package managers included for running test scripts
 */
export const NODE_VERIFICATION_COMMANDS = new Set([
  // Package managers (for npm test, bun test, etc.)
  'npm',
  'npx',
  'bun',
  'yarn',
  'pnpm',
  // Test runners
  'vitest',
  'jest',
  'playwright',
  'mocha',
  // Type check
  'tsc',
  // Lint (read-only)
  'eslint',
  'prettier',
  'biome',
])

/**
 * Node.js development commands (run mode only)
 */
export const NODE_DEVELOPMENT_COMMANDS = new Set([
  // Runtime
  'node',
  'deno',
  // Build tools
  'esbuild',
  'vite',
  'webpack',
  'rollup',
  // Framework CLI
  'next',
  'nuxt',
  'astro',
  'remix',
])

// =============================================================================
// Python Profile
// =============================================================================

/**
 * Python verification commands (sync mode)
 */
export const PYTHON_VERIFICATION_COMMANDS = new Set([
  // Package managers (for pip install -e, pytest, etc.)
  'pip',
  'pip3',
  'pipx',
  'uv',
  // Test runners
  'pytest',
  'tox',
  'nox',
  // Type check
  'mypy',
  'pyright',
  // Lint (read-only)
  'ruff',
  'flake8',
  'pylint',
])

/**
 * Python development commands (run mode only)
 */
export const PYTHON_DEVELOPMENT_COMMANDS = new Set([
  // Runtime
  'python',
  'python3',
  // Build tools
  'poetry',
  'pdm',
  'hatch',
  'flit',
  // Environment
  'venv',
  'virtualenv',
  'conda',
  // Format (auto-fix)
  'black',
  // Framework
  'django-admin',
  'flask',
  'uvicorn',
  'gunicorn',
])

// =============================================================================
// Ruby Profile
// =============================================================================

/**
 * Ruby verification commands (sync mode)
 */
export const RUBY_VERIFICATION_COMMANDS = new Set([
  // Package managers (for bundle exec rspec, etc.)
  'bundle',
  'bundler',
  'gem',
  // Test runners
  'rspec',
  'minitest',
  'cucumber',
  // Lint (read-only)
  'rubocop',
  'standard',
])

/**
 * Ruby development commands (run mode only)
 */
export const RUBY_DEVELOPMENT_COMMANDS = new Set([
  // Runtime
  'ruby',
  'irb',
  // Build tools
  'rake',
  'thor',
  // Framework
  'rails',
  'hanami',
  'puma',
  'unicorn',
])

// =============================================================================
// Go Profile
// =============================================================================

/**
 * Go verification commands (sync mode)
 */
export const GO_VERIFICATION_COMMANDS = new Set([
  // Runtime (go test, go build)
  'go',
  // Format check
  'gofmt',
  'goimports',
  // Lint
  'golangci-lint',
  'staticcheck',
])

/**
 * Go development commands (run mode only)
 */
export const GO_DEVELOPMENT_COMMANDS = new Set([
  // Tools
  'gopls',
  'dlv',
  'goreleaser',
  'golint',
])

// =============================================================================
// Profile Command Sets (Layered)
// =============================================================================

/**
 * Profile to layered commands mapping
 * @see SPEC.md Section 5.4
 */
export const PROFILE_COMMAND_SETS: Record<ProfileName, ProfileCommandSet> = {
  base: {
    verification: BASE_STATUS_COMMANDS,
    development: BASE_COMMANDS,
  },
  node: {
    verification: NODE_VERIFICATION_COMMANDS,
    development: new Set([
      ...NODE_VERIFICATION_COMMANDS,
      ...NODE_DEVELOPMENT_COMMANDS,
    ]),
  },
  python: {
    verification: PYTHON_VERIFICATION_COMMANDS,
    development: new Set([
      ...PYTHON_VERIFICATION_COMMANDS,
      ...PYTHON_DEVELOPMENT_COMMANDS,
    ]),
  },
  ruby: {
    verification: RUBY_VERIFICATION_COMMANDS,
    development: new Set([
      ...RUBY_VERIFICATION_COMMANDS,
      ...RUBY_DEVELOPMENT_COMMANDS,
    ]),
  },
  go: {
    verification: GO_VERIFICATION_COMMANDS,
    development: new Set([
      ...GO_VERIFICATION_COMMANDS,
      ...GO_DEVELOPMENT_COMMANDS,
    ]),
  },
}

// =============================================================================
// Validation & Destructive Commands
// =============================================================================

/**
 * Commands requiring argument validation (always enabled)
 */
export const VALIDATED_COMMANDS = new Set(['chmod', 'pkill'])

/**
 * Destructive commands that require special validation
 * Only enabled when --allow-destructive flag is set (run mode only)
 * @see SPEC.md Section 6.4.2
 */
export const DESTRUCTIVE_COMMANDS = new Set(['rm', 'mv'])

/**
 * Blocked flags for destructive commands
 * @see SPEC.md Section 6.4.4
 */
export const BLOCKED_RM_FLAGS = new Set(['--no-preserve-root'])

// =============================================================================
// pkill Targets
// =============================================================================

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

// =============================================================================
// Other Patterns
// =============================================================================

/**
 * Pattern for allowed chmod modes (+x variants)
 */
export const CHMOD_ALLOWED_MODE_PATTERN = /^[ugoa]*\+x$/
