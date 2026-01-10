import { resolve } from 'node:path'
import { existsSync, statSync } from 'node:fs'

/**
 * CLI options passed from argument parsing
 */
export interface RunCommandOptions {
  projectDir?: string
  maxIterations?: string
  maxRetries?: string
  model?: string
  debug?: boolean
  sandbox?: boolean
  waitForQuota?: boolean
  allowDestructive?: boolean
  thinking?: string | boolean
}

/**
 * Validated and normalized run options
 */
export interface ValidatedRunOptions {
  projectDir: string
  maxIterations?: number
  maxRetries?: number
  model?: string
  debug: boolean
  sandboxMode: SandboxMode
  waitForQuota: boolean
  allowDestructive: boolean
  maxThinkingTokens?: number
}

/**
 * Result of option validation - discriminated union
 */
export type OptionsValidationResult =
  | { success: true; options: ValidatedRunOptions }
  | { success: false; error: string }

/**
 * Sandbox mode determination result
 */
export interface SandboxMode {
  disabled: boolean
  source: 'cli' | 'env' | 'default'
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
      error: `Thinking budget must be at least ${MIN_THINKING_TOKENS} tokens`,
    }
  }

  return { type: 'enabled', tokens }
}

/**
 * Determine sandbox mode from CLI flag and environment variable
 * Priority: CLI flag > env var > default (enabled)
 */
export function determineSandboxMode(
  cliSandbox: boolean | undefined,
  env: NodeJS.ProcessEnv,
): SandboxMode {
  if (cliSandbox === false) {
    return { disabled: true, source: 'cli' }
  }

  if (env.AUTONOE_NO_SANDBOX === '1') {
    return { disabled: true, source: 'env' }
  }

  return { disabled: false, source: 'default' }
}

/**
 * Validate all run options and return validated result
 */
export function validateRunOptions(
  options: RunCommandOptions,
  env: NodeJS.ProcessEnv = process.env,
): OptionsValidationResult {
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

  const sandboxMode = determineSandboxMode(options.sandbox, env)

  return {
    success: true,
    options: {
      projectDir,
      maxIterations: parseNumericOption(options.maxIterations),
      maxRetries: parseNumericOption(options.maxRetries),
      model: options.model,
      debug: options.debug ?? false,
      sandboxMode,
      waitForQuota: options.waitForQuota ?? false,
      allowDestructive: options.allowDestructive ?? false,
      maxThinkingTokens:
        thinkingResult.type === 'enabled' ? thinkingResult.tokens : undefined,
    },
  }
}

/**
 * Log security warnings based on sandbox and destructive settings
 * Outputs to stderr as per SPEC.md Section 6.4.6
 */
export function logSecurityWarnings(
  sandboxMode: SandboxMode,
  allowDestructive: boolean,
): void {
  if (sandboxMode.disabled) {
    if (sandboxMode.source === 'cli') {
      console.error(
        'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
      )
    } else if (sandboxMode.source === 'env') {
      console.error(
        'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.',
      )
    }
  }

  if (allowDestructive) {
    console.error(
      'Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.',
    )
  }
}
