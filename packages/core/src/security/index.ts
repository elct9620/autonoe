/**
 * Security module - Bash command validation
 * @see SPEC.md Section 6.3
 */

// Type exports
export type {
  ValidationResult,
  BashSecurity,
  BashSecurityOptions,
  ProfileName,
  ExecutionMode,
  TieredAllowCommands,
  AllowCommandsConfig,
} from './types'
export { ALL_PROFILES, isBashSecurity } from './types'

// Profile exports
export { PROFILE_COMMANDS } from './profiles'

// Main implementation
export {
  DefaultBashSecurity,
  createBashSecurityHook,
} from './defaultBashSecurity'
