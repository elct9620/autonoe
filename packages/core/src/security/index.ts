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
  CommandLayer,
  ProfileCommandSet,
} from './types'
export { ALL_PROFILES, isBashSecurity } from './types'

// Profile exports
export { PROFILE_COMMAND_SETS } from './profiles'

// Main implementation
export {
  DefaultBashSecurity,
  createBashSecurityHook,
} from './defaultBashSecurity'
