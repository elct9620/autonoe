/**
 * Exit reason for session runner loop
 * @see SPEC.md Section 3.10
 */
export enum ExitReason {
  AllPassed = 'all_passed',
  AllBlocked = 'all_blocked',
  MaxIterations = 'max_iterations',
  QuotaExceeded = 'quota_exceeded',
  Interrupted = 'interrupted',
  MaxRetriesExceeded = 'max_retries_exceeded',
}
