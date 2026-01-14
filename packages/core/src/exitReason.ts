/**
 * Exit reason for session runner loop
 * @see SPEC.md Section 3.10, Section 9.9
 */
export type ExitReason =
  | 'all_passed'
  | 'all_blocked'
  | 'all_verified'
  | 'max_iterations'
  | 'quota_exceeded'
  | 'interrupted'
  | 'max_retries_exceeded'
