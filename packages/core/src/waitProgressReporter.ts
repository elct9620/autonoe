/**
 * Reports progress during long-running wait operations
 * Enables dependency injection for testability
 * @see SPEC.md Section 3.4 Quota Wait Progress Feedback
 */
export interface WaitProgressReporter {
  /**
   * Start reporting progress for a wait operation
   * @param totalMs - Total wait duration in milliseconds
   * @param resetTime - The time when quota resets (for display)
   * @returns A cleanup function to call when wait is complete
   */
  startWait(totalMs: number, resetTime?: Date): () => void
}

/**
 * Silent implementation that does nothing
 * Used as default when no reporter is provided
 */
export const silentWaitProgressReporter: WaitProgressReporter = {
  startWait: () => () => {},
}
