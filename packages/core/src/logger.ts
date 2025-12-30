/**
 * Log levels for Autonoe output
 * @see SPEC.md Section 3.7
 */
export type LogLevel = 'info' | 'debug' | 'warning' | 'error'

/**
 * Logger interface for session output
 * @see SPEC.md Section 3.7
 */
export interface Logger {
  /**
   * Log informational message (always shown)
   * Used for: session start/end, configuration display
   */
  info(message: string): void

  /**
   * Log debug message (hidden by default, shown with --debug flag)
   * Used for: internal operations, message tracing
   */
  debug(message: string): void

  /**
   * Log warning message (always shown)
   * Used for: non-fatal issues, deprecations
   */
  warn(message: string): void

  /**
   * Log error message (always shown)
   * Used for: failures, critical errors
   * @param error - Optional Error object for stack trace logging
   */
  error(message: string, error?: Error): void
}

/**
 * Silent logger that discards all output
 * Used as default when no logger is provided
 */
export const silentLogger: Logger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {},
}
