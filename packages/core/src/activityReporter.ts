/**
 * Activity feedback during Session execution
 * Provides visibility into Agent operation status
 * @see SPEC.md Section 3.5 Activity Feedback
 */

/**
 * ActivityEvent - Discriminated union of activity events
 * @see docs/interfaces.md#activityreporter
 */
export type ActivityEvent =
  | { type: 'tool_start'; toolName: string; elapsedMs: number }
  | {
      type: 'tool_complete'
      toolName: string
      isError: boolean
      elapsedMs: number
    }
  | { type: 'thinking'; elapsedMs: number }
  | { type: 'responding'; elapsedMs: number }
  | {
      type: 'waiting'
      remainingMs: number
      resetTime: Date
      elapsedMs: number
    }

/**
 * ActivityEventType - Discriminator type for ActivityEvent
 */
export type ActivityEventType = ActivityEvent['type']

/**
 * RawActivityEvent - Activity event without elapsedMs (added by SessionRunner)
 * Used internally by Session.run() callback
 */
export type RawActivityEvent =
  | { type: 'tool_start'; toolName: string }
  | { type: 'tool_complete'; toolName: string; isError: boolean }
  | { type: 'thinking' }
  | { type: 'responding' }

/**
 * ActivityCallback - Callback type for Session.run() onActivity parameter
 */
export type ActivityCallback = (event: RawActivityEvent) => void

/**
 * ActivityReporter - Interface for activity feedback
 * @see SPEC.md Section 3.5, docs/interfaces.md#activityreporter
 */
export interface ActivityReporter {
  /**
   * Start activity reporting for a session
   * @returns Cleanup function to call when session ends
   */
  startSession(): () => void

  /**
   * Report an activity event
   * @param event - The activity event to report
   */
  reportActivity(event: ActivityEvent): void
}

/**
 * Silent implementation that does nothing
 * Used as default when no reporter is provided
 */
export const silentActivityReporter: ActivityReporter = {
  startSession: () => () => {},
  reportActivity: () => {},
}
