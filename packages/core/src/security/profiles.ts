/**
 * Profile command sets
 * @see SPEC.md Section 5.4, 6.4
 */

import type { ProfileName } from './types'

// =============================================================================
// Base Profile
// =============================================================================

/**
 * Base read-only commands (available in all modes)
 * All read-only commands that don't modify system state
 * @see SPEC.md Section 6.2
 */
export const BASE_READONLY_COMMANDS = new Set([
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
  'printf',
  'uniq',
  'cut',
  'tr',
  'tac',
  'jq',
  // Git (sync needs to read version state)
  'git',
  // Process Query (read-only)
  'which',
  'ps',
  'lsof',
  // Utility (safe, no state modification)
  'echo',
  'sleep',
])

/**
 * Run-only extension commands (file operations)
 * Commands that modify filesystem, only available in run mode
 * @see SPEC.md Section 6.3
 */
export const RUN_EXTENSION_COMMANDS = new Set([
  // File Ops (modify filesystem)
  'mkdir',
  'cp',
])

// =============================================================================
// Node.js Profile
// =============================================================================

/**
 * Node.js commands (available in all modes)
 */
export const NODE_COMMANDS = new Set([
  // Package managers
  'npm',
  'npx',
  'yarn',
  'pnpm',
  // Test runners
  'vitest',
  'jest',
  'playwright',
  'mocha',
  // Type check
  'tsc',
  // Lint
  'eslint',
  'prettier',
  'biome',
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
// Bun Profile
// =============================================================================

/**
 * Bun commands (available in all modes)
 */
export const BUN_COMMANDS = new Set([
  // Runtime and package manager
  'bun',
  'bunx',
])

// =============================================================================
// Python Profile
// =============================================================================

/**
 * Python commands (available in all modes)
 */
export const PYTHON_COMMANDS = new Set([
  // Package managers
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
  // Lint
  'ruff',
  'flake8',
  'pylint',
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
  // Format
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
 * Ruby commands (available in all modes)
 */
export const RUBY_COMMANDS = new Set([
  // Package managers
  'bundle',
  'bundler',
  'gem',
  // Test runners
  'rspec',
  'minitest',
  'cucumber',
  // Lint
  'rubocop',
  'standard',
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
 * Go commands (available in all modes)
 */
export const GO_COMMANDS = new Set([
  // Runtime and build
  'go',
  // Format
  'gofmt',
  'goimports',
  // Lint
  'golangci-lint',
  'staticcheck',
  'golint',
  // Tools
  'gopls',
  'dlv',
  'goreleaser',
])

// =============================================================================
// Rust Profile
// =============================================================================

/**
 * Rust commands (available in all modes)
 */
export const RUST_COMMANDS = new Set([
  // Runtime
  'rustc',
  'rustup',
  // Package manager and build
  'cargo',
  // Format
  'rustfmt',
  'cargo-fmt',
  // Lint
  'clippy',
  'cargo-clippy',
  // Tools
  'rust-analyzer',
  'cargo-watch',
])

// =============================================================================
// PHP Profile
// =============================================================================

/**
 * PHP commands (available in all modes)
 */
export const PHP_COMMANDS = new Set([
  // Runtime
  'php',
  // Package manager
  'composer',
  // Test runners
  'phpunit',
  'pest',
  'codeception',
  // Lint and static analysis
  'phpcs',
  'phpcbf',
  'phpstan',
  'psalm',
  'php-cs-fixer',
  // Framework CLI
  'artisan',
  'symfony',
  'laminas',
])

// =============================================================================
// Profile Command Mapping
// =============================================================================

/**
 * Profile to commands mapping (language profiles only)
 * Base profile is handled separately via BASE_READONLY_COMMANDS and RUN_EXTENSION_COMMANDS
 */
export const PROFILE_COMMANDS: Record<
  Exclude<ProfileName, 'base'>,
  Set<string>
> = {
  node: NODE_COMMANDS,
  bun: BUN_COMMANDS,
  python: PYTHON_COMMANDS,
  ruby: RUBY_COMMANDS,
  go: GO_COMMANDS,
  rust: RUST_COMMANDS,
  php: PHP_COMMANDS,
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
export const BUN_PKILL_TARGETS = new Set(['bun'])
export const PYTHON_PKILL_TARGETS = new Set([
  'python',
  'python3',
  'uvicorn',
  'gunicorn',
])
export const RUBY_PKILL_TARGETS = new Set(['ruby', 'puma', 'unicorn', 'rails'])
export const GO_PKILL_TARGETS = new Set(['go'])
export const RUST_PKILL_TARGETS = new Set(['cargo'])
export const PHP_PKILL_TARGETS = new Set(['php', 'artisan'])

/**
 * Profile to pkill targets mapping
 */
export const PROFILE_PKILL_TARGETS: Record<ProfileName, Set<string>> = {
  base: new Set(),
  node: NODE_PKILL_TARGETS,
  bun: BUN_PKILL_TARGETS,
  python: PYTHON_PKILL_TARGETS,
  ruby: RUBY_PKILL_TARGETS,
  go: GO_PKILL_TARGETS,
  rust: RUST_PKILL_TARGETS,
  php: PHP_PKILL_TARGETS,
}

// =============================================================================
// Other Patterns
// =============================================================================

/**
 * Pattern for allowed chmod modes (+x variants)
 */
export const CHMOD_ALLOWED_MODE_PATTERN = /^[ugoa]*\+x$/
