import { resolve, join } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import type { Logger } from '@autonoe/core'

// ========== Model Defaults ==========

export const DEFAULT_CODING_MODEL = 'sonnet'
export const DEFAULT_PLANNING_MODEL = 'opus'

// ========== Common Options (Cost Control + Base) ==========

/**
 * CLI common options shared between run and sync commands
 */
export interface CommonCommandOptions {
  projectDir?: string
  maxIterations?: string
  maxRetries?: string
  model?: string
  planModel?: string
  debug?: boolean
  waitForQuota?: boolean
  thinking?: string | boolean
}

/**
 * Validated and normalized common options
 */
export interface ValidatedCommonOptions {
  projectDir: string
  maxIterations?: number
  maxRetries?: number
  model?: string
  planModel?: string
  debug: boolean
  waitForQuota: boolean
  maxThinkingTokens?: number
  sandboxMode: SandboxMode
}

/**
 * Result of common option validation - discriminated union
 */
export type CommonOptionsValidationResult =
  | { success: true; options: ValidatedCommonOptions }
  | { success: false; error: string }

// ========== Run Command Options (Security-related) ==========

/**
 * CLI options for run command (extends common options)
 */
export interface RunCommandOptions extends CommonCommandOptions {
  sandbox?: boolean
  allowDestructive?: boolean
}

/**
 * Validated and normalized run options (extends common options)
 */
export interface ValidatedRunOptions extends ValidatedCommonOptions {
  sandboxMode: SandboxMode
  allowDestructive: boolean
}

/**
 * Result of run option validation - discriminated union
 */
export type RunOptionsValidationResult =
  | { success: true; options: ValidatedRunOptions }
  | { success: false; error: string }

// ========== Sync Command Options (uses common directly) ==========

/**
 * CLI options for sync command (same as common options)
 */
export type SyncCommandOptions = CommonCommandOptions

/**
 * Validated sync options (same as common validated options)
 */
export type ValidatedSyncOptions = ValidatedCommonOptions

/**
 * Result of sync option validation (same as common)
 */
export type SyncOptionsValidationResult = CommonOptionsValidationResult

// ========== Backward Compatibility ==========

/**
 * @deprecated Use RunOptionsValidationResult instead
 */
export type OptionsValidationResult = RunOptionsValidationResult

/**
 * Sandbox mode source - where the sandbox setting was determined
 */
export type SandboxSource = 'cli' | 'env' | 'default'

/**
 * SandboxMode - immutable representation of sandbox configuration
 */
export interface SandboxMode {
  readonly disabled: boolean
  readonly source: SandboxSource
}

/**
 * Create enabled sandbox mode (default state)
 */
export function sandboxEnabled(): SandboxMode {
  return { disabled: false, source: 'default' }
}

/**
 * Create disabled sandbox mode from CLI flag
 */
export function sandboxDisabledByCli(): SandboxMode {
  return { disabled: true, source: 'cli' }
}

/**
 * Create disabled sandbox mode from environment variable
 */
export function sandboxDisabledByEnv(): SandboxMode {
  return { disabled: true, source: 'env' }
}

/**
 * Determine sandbox mode from CLI flag and environment variable
 * Priority: CLI flag > env var > default (enabled)
 */
export function createSandboxMode(
  cliSandbox: boolean | undefined,
  env: NodeJS.ProcessEnv,
): SandboxMode {
  if (cliSandbox === false) {
    return sandboxDisabledByCli()
  }

  if (env.AUTONOE_NO_SANDBOX === '1') {
    return sandboxDisabledByEnv()
  }

  return sandboxEnabled()
}

/**
 * Get the warning message for disabled sandbox, if any
 * Returns undefined if sandbox is enabled
 */
export function getSandboxWarningMessage(
  mode: SandboxMode,
): string | undefined {
  if (!mode.disabled) {
    return undefined
  }

  if (mode.source === 'cli') {
    return 'Warning: SDK sandbox is disabled. System-level isolation is not enforced.'
  }

  if (mode.source === 'env') {
    return 'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.'
  }

  return undefined
}

/**
 * Thinking option parse result - discriminated union
 */
export type ThinkingParseResult =
  | { type: 'enabled'; tokens: number }
  | { type: 'disabled' }
  | { type: 'error'; error: string }

const DEFAULT_THINKING_TOKENS = 8192
const MIN_THINKING_TOKENS = 1024

/**
 * Validate that path exists and is a directory
 */
export function validateProjectDir(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

/**
 * Parse string to number, returns undefined for undefined input or NaN result
 */
export function parseNumericOption(
  value: string | undefined,
): number | undefined {
  if (value === undefined) return undefined
  const num = parseInt(value, 10)
  return Number.isNaN(num) ? undefined : num
}

/**
 * Parse thinking option (boolean | string) to token budget
 * - true: use default (8192)
 * - string: parse as number, error if below minimum (1024)
 * - undefined: disabled
 */
export function parseThinkingOption(
  thinking: string | boolean | undefined,
): ThinkingParseResult {
  if (thinking === undefined || thinking === false) {
    return { type: 'disabled' }
  }

  if (thinking === true) {
    return { type: 'enabled', tokens: DEFAULT_THINKING_TOKENS }
  }

  const tokens = parseInt(thinking, 10)
  if (Number.isNaN(tokens)) {
    return { type: 'error', error: `Invalid thinking budget: ${thinking}` }
  }

  if (tokens < MIN_THINKING_TOKENS) {
    return {
      type: 'error',
      error: `Thinking budget must be at least ${MIN_THINKING_TOKENS} tokens, got ${tokens}`,
    }
  }

  return { type: 'enabled', tokens }
}

/**
 * Validate common options shared between run and sync commands
 */
export function validateCommonOptions(
  options: CommonCommandOptions,
  env: NodeJS.ProcessEnv = process.env,
): CommonOptionsValidationResult {
  const projectDir = options.projectDir
    ? resolve(options.projectDir)
    : process.cwd()

  if (!validateProjectDir(projectDir)) {
    return {
      success: false,
      error: `Project directory does not exist: ${projectDir}`,
    }
  }

  const thinkingResult = parseThinkingOption(options.thinking)
  if (thinkingResult.type === 'error') {
    return { success: false, error: thinkingResult.error }
  }

  // Validate maxIterations constraint: must be > 0 if specified
  const maxIterations = parseNumericOption(options.maxIterations)
  if (maxIterations !== undefined && maxIterations <= 0) {
    return {
      success: false,
      error: `Max iterations must be positive, got ${maxIterations}`,
    }
  }

  // Validate maxRetries constraint: must be >= 0 if specified
  const maxRetries = parseNumericOption(options.maxRetries)
  if (maxRetries !== undefined && maxRetries < 0) {
    return {
      success: false,
      error: `Max retries must be non-negative, got ${maxRetries}`,
    }
  }

  // Create SandboxMode from environment variable only
  // CLI flag override is handled by validateRunOptions
  const sandboxMode = createSandboxMode(undefined, env)

  return {
    success: true,
    options: {
      projectDir,
      maxIterations,
      maxRetries,
      model: options.model,
      planModel: options.planModel,
      debug: options.debug ?? false,
      waitForQuota: options.waitForQuota ?? false,
      maxThinkingTokens:
        thinkingResult.type === 'enabled' ? thinkingResult.tokens : undefined,
      sandboxMode,
    },
  }
}

/**
 * Validate sync options
 */
export function validateSyncOptions(
  options: SyncCommandOptions,
  env: NodeJS.ProcessEnv = process.env,
): SyncOptionsValidationResult {
  return validateCommonOptions(options, env)
}

/**
 * Validate all run options and return validated result
 */
export function validateRunOptions(
  options: RunCommandOptions,
  env: NodeJS.ProcessEnv = process.env,
): RunOptionsValidationResult {
  const commonResult = validateCommonOptions(options, env)
  if (!commonResult.success) {
    return commonResult
  }

  // Override sandboxMode if CLI flag is provided
  const sandboxMode =
    options.sandbox === false
      ? sandboxDisabledByCli()
      : commonResult.options.sandboxMode

  return {
    success: true,
    options: {
      ...commonResult.options,
      sandboxMode,
      allowDestructive: options.allowDestructive ?? false,
    },
  }
}

/**
 * Log security warnings based on sandbox and destructive settings
 * Outputs to stderr as per SPEC.md Section 6.4.6
 */
export function logSecurityWarnings(
  logger: Logger,
  sandboxMode: SandboxMode,
  allowDestructive: boolean,
): void {
  const sandboxWarning = getSandboxWarningMessage(sandboxMode)
  if (sandboxWarning) {
    logger.warn(sandboxWarning)
  }

  if (allowDestructive) {
    logger.warn(
      'Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.',
    )
  }
}

// ========== Prerequisites ==========

/**
 * Prerequisite validation result - discriminated union
 */
export type PrerequisiteValidationResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Check if SPEC.md exists in the project directory
 */
export function checkSpecExists(projectDir: string): boolean {
  const specPath = join(projectDir, 'SPEC.md')
  return existsSync(specPath)
}

/**
 * Validate prerequisites for command execution
 * Currently checks: SPEC.md existence
 */
export function validatePrerequisites(
  projectDir: string,
): PrerequisiteValidationResult {
  if (!checkSpecExists(projectDir)) {
    return {
      success: false,
      error: `SPEC.md not found in ${projectDir}`,
    }
  }

  return { success: true }
}
