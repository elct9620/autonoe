import type { Logger, StreamEvent } from '@autonoe/core'

/**
 * Presenter interface for unified output coordination
 * Combines Logger methods with activity display capabilities
 * @see SPEC.md Section 3.5, docs/interfaces.md
 */
export interface Presenter extends Logger {
  /**
   * Handle a StreamEvent for activity display
   * @param event - The StreamEvent to display
   */
  activity(event: StreamEvent): void

  /**
   * Clear the activity line
   */
  clearActivity(): void

  /**
   * Start the presenter (e.g., begin interval timers)
   */
  start(): void

  /**
   * Stop the presenter and clean up (e.g., clear intervals, clear activity line)
   */
  stop(): void
}
