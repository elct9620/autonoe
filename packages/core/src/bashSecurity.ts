/**
 * Bash command security validation
 * @see SPEC.md Section 6.3
 */

import { resolve, normalize } from 'node:path'
import { realpathSync, existsSync } from 'node:fs'
import type { PreToolUseHook, PreToolUseInput, HookResult } from './agentClient'

export interface ValidationResult {
  allowed: boolean
  reason?: string
}

export interface BashSecurity {
  isCommandAllowed(command: string): ValidationResult
}

/**
 * Available language profiles for bash command filtering
 * @see SPEC.md Section 6.3.1
 */
export type ProfileName = 'base' | 'node' | 'python' | 'ruby' | 'go'

/**
 * All available profiles
 */
export const ALL_PROFILES: readonly ProfileName[] = Object.freeze([
  'base',
  'node',
  'python',
  'ruby',
  'go',
])

/**
 * Options for configuring BashSecurity
 */
export interface BashSecurityOptions {
  /**
   * Active profiles. If undefined or empty, ALL profiles are enabled.
   * The 'base' profile is always implicitly included.
   */
  activeProfiles?: ProfileName[]

  /**
   * Additional commands to allow (user extensions via agent.json)
   */
  allowCommands?: string[]

  /**
   * Additional pkill targets to allow (user extensions via agent.json)
   */
  allowPkillTargets?: string[]

  /**
   * Enable rm and mv commands with path validation
   * @see SPEC.md Section 6.4
   */
  allowDestructive?: boolean

  /**
   * Project directory for path validation (required when allowDestructive is true)
   */
  projectDir?: string
}

/**
 * Type guard to check if value is a BashSecurity instance
 */
function isBashSecurity(
  value: BashSecurity | BashSecurityOptions | undefined,
): value is BashSecurity {
  return value !== undefined && 'isCommandAllowed' in value
}

/**
 * Create a PreToolUse hook for bash command security
 *
 * @param securityOrOptions - BashSecurity instance or options to create one
 * @returns PreToolUseHook that validates bash commands
 */
export function createBashSecurityHook(
  securityOrOptions?: BashSecurity | BashSecurityOptions,
): PreToolUseHook {
  const security = isBashSecurity(securityOrOptions)
    ? securityOrOptions
    : new DefaultBashSecurity(securityOrOptions ?? {})

  return {
    name: 'bash-security',
    matcher: 'Bash',
    callback: async (input: PreToolUseInput): Promise<HookResult> => {
      const command = input.toolInput.command as string | undefined

      if (!command) {
        return { continue: true, decision: 'approve' }
      }

      const result = security.isCommandAllowed(command)

      if (result.allowed) {
        return { continue: true, decision: 'approve' }
      }

      return {
        continue: false,
        decision: 'block',
        reason: result.reason ?? 'Command not allowed',
      }
    },
  }
}

/**
 * Base profile commands (always included)
 * @see SPEC.md Section 6.3.2
 */
const BASE_COMMANDS = new Set([
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
])

/**
 * Node.js profile commands
 * @see SPEC.md Section 6.3.2
 */
const NODE_COMMANDS = new Set([
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
const PYTHON_COMMANDS = new Set([
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
const RUBY_COMMANDS = new Set([
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
const GO_COMMANDS = new Set([
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
const PROFILE_COMMANDS: Record<ProfileName, Set<string>> = {
  base: BASE_COMMANDS,
  node: NODE_COMMANDS,
  python: PYTHON_COMMANDS,
  ruby: RUBY_COMMANDS,
  go: GO_COMMANDS,
}

/**
 * Commands requiring argument validation (always enabled)
 */
const VALIDATED_COMMANDS = new Set(['chmod', 'pkill'])

/**
 * Destructive commands that require special validation
 * Only enabled when --allow-destructive flag is set
 * @see SPEC.md Section 6.4.2
 */
const DESTRUCTIVE_COMMANDS = new Set(['rm', 'mv'])

/**
 * Blocked flags for destructive commands
 * @see SPEC.md Section 6.4.4
 */
const BLOCKED_RM_FLAGS = new Set(['--no-preserve-root'])

/**
 * pkill targets per profile
 * @see SPEC.md Section 6.3.3
 */
const NODE_PKILL_TARGETS = new Set(['node', 'npm', 'npx', 'vite', 'next'])
const PYTHON_PKILL_TARGETS = new Set([
  'python',
  'python3',
  'uvicorn',
  'gunicorn',
])
const RUBY_PKILL_TARGETS = new Set(['ruby', 'puma', 'unicorn', 'rails'])
const GO_PKILL_TARGETS = new Set(['go'])

/**
 * Profile to pkill targets mapping
 */
const PROFILE_PKILL_TARGETS: Record<ProfileName, Set<string>> = {
  base: new Set(),
  node: NODE_PKILL_TARGETS,
  python: PYTHON_PKILL_TARGETS,
  ruby: RUBY_PKILL_TARGETS,
  go: GO_PKILL_TARGETS,
}

/**
 * Pattern for allowed chmod modes (+x variants)
 */
const CHMOD_ALLOWED_MODE_PATTERN = /^[ugoa]*\+x$/

/**
 * Validate chmod command arguments
 * - Allows: +x, u+x, g+x, o+x, a+x, ug+x, etc.
 * - Blocks: -R (recursive), numeric modes (755, 777)
 */
function validateChmod(args: string[]): ValidationResult {
  if (args.length < 2) {
    return { allowed: false, reason: 'chmod requires mode and target file(s)' }
  }

  // Check for -R flag anywhere in args
  if (args.some((arg) => arg === '-R' || arg.startsWith('-R'))) {
    return { allowed: false, reason: 'chmod -R (recursive) is not allowed' }
  }

  const mode = args[0]!

  // Block numeric modes (e.g., 755, 777)
  if (/^\d+$/.test(mode)) {
    return { allowed: false, reason: 'chmod numeric modes are not allowed' }
  }

  // Only allow +x variants
  if (!CHMOD_ALLOWED_MODE_PATTERN.test(mode)) {
    return {
      allowed: false,
      reason: `chmod mode '${mode}' is not allowed, only +x variants permitted`,
    }
  }

  return { allowed: true }
}

/**
 * Validate bin/dev.sh script execution
 * - Allows: ./bin/dev.sh, bin/dev.sh (without arguments)
 * - Blocks: Any arguments (prevent injection)
 */
function validateDevScript(args: string[]): ValidationResult {
  if (args.length > 0) {
    return {
      allowed: false,
      reason: 'bin/dev.sh does not accept arguments',
    }
  }
  return { allowed: true }
}

/**
 * Validate that a path is within the project directory
 * @see SPEC.md Section 6.4.3
 *
 * Steps:
 * 1. Resolve against projectDir
 * 2. Resolve symlinks with fs.realpathSync()
 * 3. Normalize path (remove . and ..)
 * 4. Verify starts with projectDir
 */
function validatePathWithinProject(
  inputPath: string,
  projectDir: string,
): ValidationResult {
  try {
    // Step 1: Resolve against projectDir
    const resolved = resolve(projectDir, inputPath)

    // Step 2: Resolve symlinks (only if path exists)
    let realPath: string
    if (existsSync(resolved)) {
      try {
        realPath = realpathSync(resolved)
      } catch {
        // If symlink resolution fails, treat as escape
        return {
          allowed: false,
          reason: 'Symlink target escapes project directory',
        }
      }
    } else {
      // For non-existent paths, just use resolved
      realPath = resolved
    }

    // Step 3: Normalize (remove . and ..)
    const normalizedPath = normalize(realPath)
    const normalizedProjectDir = normalize(projectDir)

    // Step 4: Verify starts with projectDir
    if (
      !normalizedPath.startsWith(normalizedProjectDir + '/') &&
      normalizedPath !== normalizedProjectDir
    ) {
      return {
        allowed: false,
        reason: `Path '${inputPath}' escapes project directory`,
      }
    }

    return { allowed: true }
  } catch {
    return {
      allowed: false,
      reason: 'Symlink target escapes project directory',
    }
  }
}

/**
 * Validate rm command arguments
 * - Checks for blocked flags (--no-preserve-root)
 * - Validates all paths are within project directory
 * @see SPEC.md Section 6.4
 */
function validateRm(args: string[], projectDir: string): ValidationResult {
  // Check for blocked flags
  for (const arg of args) {
    if (BLOCKED_RM_FLAGS.has(arg)) {
      return {
        allowed: false,
        reason: `Flag '${arg}' is not allowed with rm`,
      }
    }
  }

  // Extract paths (skip flags starting with -)
  const paths = args.filter((arg) => !arg.startsWith('-'))

  if (paths.length === 0) {
    return { allowed: false, reason: 'rm requires at least one file path' }
  }

  // Validate each path is within project
  for (const path of paths) {
    const result = validatePathWithinProject(path, projectDir)
    if (!result.allowed) {
      return result
    }
  }

  return { allowed: true }
}

/**
 * Validate mv command arguments
 * - Validates both source and destination paths are within project directory
 * @see SPEC.md Section 6.4
 */
function validateMv(args: string[], projectDir: string): ValidationResult {
  // Extract paths (skip flags starting with -)
  const paths = args.filter((arg) => !arg.startsWith('-'))

  if (paths.length < 2) {
    return {
      allowed: false,
      reason: 'mv requires source and destination paths',
    }
  }

  // Validate each path is within project
  for (const path of paths) {
    const result = validatePathWithinProject(path, projectDir)
    if (!result.allowed) {
      return result
    }
  }

  return { allowed: true }
}

/**
 * Split command string into individual commands by chain operators
 * Handles: &&, ||, |, ;
 */
function splitCommandChain(command: string): string[] {
  const commands: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    const nextChar = command[i + 1]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      current += char
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      current += char
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      current += char
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      // Check for operators
      if (char === ';') {
        if (current.trim()) commands.push(current.trim())
        current = ''
        continue
      }

      if (char === '|') {
        if (nextChar === '|') {
          // ||
          if (current.trim()) commands.push(current.trim())
          current = ''
          i++ // skip next |
          continue
        } else {
          // single pipe
          if (current.trim()) commands.push(current.trim())
          current = ''
          continue
        }
      }

      if (char === '&' && nextChar === '&') {
        if (current.trim()) commands.push(current.trim())
        current = ''
        i++ // skip next &
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    commands.push(current.trim())
  }

  return commands
}

/**
 * Parse a single command into base command, full command path, and arguments
 */
function parseCommand(command: string): {
  base: string
  fullCommand: string
  args: string[]
} {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  if (tokens.length === 0) {
    return { base: '', fullCommand: '', args: [] }
  }

  // Extract base command name (handle paths like /usr/bin/git)
  const fullCommand = tokens[0]!
  const base = fullCommand.includes('/')
    ? (fullCommand.split('/').pop() ?? fullCommand)
    : fullCommand

  return { base, fullCommand, args: tokens.slice(1) }
}

/**
 * Default implementation of BashSecurity
 */
export class DefaultBashSecurity implements BashSecurity {
  private readonly allowedCommands: Set<string>
  private readonly allowedPkillTargets: Set<string>
  private readonly allowDestructive: boolean
  private readonly projectDir: string | undefined

  constructor(options: BashSecurityOptions = {}) {
    const profiles = this.resolveActiveProfiles(options.activeProfiles)
    this.allowedCommands = this.buildAllowedCommands(profiles, options)
    this.allowedPkillTargets = this.buildAllowedPkillTargets(profiles, options)
    this.allowDestructive = options.allowDestructive ?? false
    this.projectDir = options.projectDir
  }

  /**
   * Resolve active profiles
   * - undefined/empty: ALL profiles
   * - specified: base + specified profiles
   */
  private resolveActiveProfiles(activeProfiles?: ProfileName[]): ProfileName[] {
    if (!activeProfiles || activeProfiles.length === 0) {
      return [...ALL_PROFILES]
    }

    // Always include base profile
    const profiles = new Set<ProfileName>(['base'])
    for (const profile of activeProfiles) {
      profiles.add(profile)
    }
    return [...profiles]
  }

  /**
   * Build the effective command allowlist from active profiles + extensions
   */
  private buildAllowedCommands(
    profiles: ProfileName[],
    options: BashSecurityOptions,
  ): Set<string> {
    const commands = new Set<string>()

    // Add commands from each active profile
    for (const profile of profiles) {
      const profileCommands = PROFILE_COMMANDS[profile]
      for (const cmd of profileCommands) {
        commands.add(cmd)
      }
    }

    // Add user extensions
    if (options.allowCommands) {
      for (const cmd of options.allowCommands) {
        commands.add(cmd)
      }
    }

    return commands
  }

  /**
   * Build the effective pkill targets from active profiles + extensions
   */
  private buildAllowedPkillTargets(
    profiles: ProfileName[],
    options: BashSecurityOptions,
  ): Set<string> {
    const targets = new Set<string>()

    for (const profile of profiles) {
      const profileTargets = PROFILE_PKILL_TARGETS[profile]
      for (const target of profileTargets) {
        targets.add(target)
      }
    }

    // Add user extensions
    if (options.allowPkillTargets) {
      for (const target of options.allowPkillTargets) {
        targets.add(target)
      }
    }

    return targets
  }

  isCommandAllowed(command: string): ValidationResult {
    // Handle empty command
    if (!command || !command.trim()) {
      return { allowed: true }
    }

    // Split into individual commands
    const commands = splitCommandChain(command)

    // If any command in the chain is blocked, entire chain is denied
    for (const cmd of commands) {
      const result = this.validateSingleCommand(cmd)
      if (!result.allowed) {
        return result
      }
    }

    return { allowed: true }
  }

  private validateSingleCommand(command: string): ValidationResult {
    const { base, fullCommand, args } = parseCommand(command)

    if (!base) {
      return { allowed: true }
    }

    // Special handling for bin/dev.sh script execution
    if (fullCommand === './bin/dev.sh' || fullCommand === 'bin/dev.sh') {
      return validateDevScript(args)
    }

    // Handle destructive commands (rm, mv)
    if (DESTRUCTIVE_COMMANDS.has(base)) {
      if (!this.allowDestructive) {
        return {
          allowed: false,
          reason: `Command '${base}' is not in the allowlist`,
        }
      }

      if (!this.projectDir) {
        return {
          allowed: false,
          reason: 'Destructive commands require projectDir to be set',
        }
      }

      if (base === 'rm') {
        return validateRm(args, this.projectDir)
      }
      if (base === 'mv') {
        return validateMv(args, this.projectDir)
      }
    }

    // Check if command requires argument validation
    if (VALIDATED_COMMANDS.has(base)) {
      if (base === 'chmod') {
        return validateChmod(args)
      }
      if (base === 'pkill') {
        return this.validatePkill(args)
      }
    }

    // Check computed allowlist
    if (this.allowedCommands.has(base)) {
      return { allowed: true }
    }

    // Command not in allowlist
    return {
      allowed: false,
      reason: `Command '${base}' is not in the allowlist`,
    }
  }

  /**
   * Validate pkill command arguments with profile-aware targets
   */
  private validatePkill(args: string[]): ValidationResult {
    if (args.length === 0) {
      return { allowed: false, reason: 'pkill requires a process name' }
    }

    // Find the process name (skip flags like -f, -9)
    const processName = args.find((arg) => !arg.startsWith('-'))

    if (!processName) {
      return { allowed: false, reason: 'pkill requires a process name' }
    }

    if (!this.allowedPkillTargets.has(processName)) {
      return {
        allowed: false,
        reason: `pkill target '${processName}' is not allowed, only dev processes permitted`,
      }
    }

    return { allowed: true }
  }
}
