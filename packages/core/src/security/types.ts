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
export function isBashSecurity(
  value: BashSecurity | BashSecurityOptions | undefined,
): value is BashSecurity {
  return value !== undefined && 'isCommandAllowed' in value
}
