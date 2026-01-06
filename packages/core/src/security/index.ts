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
} from './types'
export { ALL_PROFILES, isBashSecurity } from './types'

// Main implementation
export {
  DefaultBashSecurity,
  createBashSecurityHook,
} from './defaultBashSecurity'
