/**
 * Exit reason for session runner loop
 * @see SPEC.md Section 3.10
 */
export type ExitReason =
  | 'all_passed'
  | 'all_blocked'
  | 'max_iterations'
  | 'quota_exceeded'
  | 'interrupted'
  | 'max_retries_exceeded'
