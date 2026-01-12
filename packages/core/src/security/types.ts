/**
 * Bash command security types
 * @see SPEC.md Section 6.3
 */

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
 * Execution mode affecting command allowlist
 * @see SPEC.md Section 5.4
 */
export type ExecutionMode = 'run' | 'sync'

/**
 * Command layers for security modes
 * @see SPEC.md Section 5.4
 */
export type CommandLayer = 'verification' | 'development'

/**
 * Profile command structure with layers
 */
export interface ProfileCommandSet {
  verification: Set<string>
  development: Set<string>
}

/**
 * Options for configuring BashSecurity
 */
export interface BashSecurityOptions {
  /**
   * Execution mode determines command layer
   * - 'run': development layer (full toolchain)
   * - 'sync': verification layer (test/lint/build only)
   * @default 'run'
   */
  mode?: ExecutionMode

  /**
   * Active profiles. If undefined or empty, ALL profiles are enabled.
   * The 'base' profile is always implicitly included.
   */
  activeProfiles?: ProfileName[]

  /**
   * Additional commands to allow (user extensions via agent.json)
   * Note: Ignored in sync mode for security
   */
  allowCommands?: string[]

  /**
   * Additional pkill targets to allow (user extensions via agent.json)
   */
  allowPkillTargets?: string[]

  /**
   * Enable rm and mv commands with path validation
   * Note: Always disabled in sync mode
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
export function isBashSecurity(
  value: BashSecurity | BashSecurityOptions | undefined,
): value is BashSecurity {
  return value !== undefined && 'isCommandAllowed' in value
}
