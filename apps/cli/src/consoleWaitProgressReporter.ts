import type { WaitProgressReporter } from '@autonoe/core'
import { formatDuration } from '@autonoe/core'

/**
 * Options for ConsoleWaitProgressReporter
 */
export interface ConsoleWaitProgressReporterOptions {
  /**
   * Update interval in milliseconds (default: 60000 = 1 minute)
   */
  updateIntervalMs?: number
}

/**
 * Console-based progress reporter for quota wait operations
 * Displays countdown with single-line overwrite
 * @see SPEC.md Section 3.4 Quota Wait Progress Feedback
 */
export class ConsoleWaitProgressReporter implements WaitProgressReporter {
  private static readonly RESET = '\x1b[0m'
  private static readonly CYAN = '\x1b[36m'

  private readonly updateIntervalMs: number

  constructor(options: ConsoleWaitProgressReporterOptions = {}) {
    this.updateIntervalMs = options.updateIntervalMs ?? 60000
  }

  startWait(totalMs: number, resetTime?: Date): () => void {
    let stopped = false
    const endTime = Date.now() + totalMs

    const formatResetTime = (date: Date): string => {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    }

    const tick = () => {
      if (stopped) return

      const remaining = endTime - Date.now()
      if (remaining > 0) {
        const message = `⏳ Waiting... ${formatDuration(remaining)} remaining`
        process.stdout.write(
          `\r${ConsoleWaitProgressReporter.CYAN}${message}${ConsoleWaitProgressReporter.RESET}`,
        )
        setTimeout(tick, this.updateIntervalMs)
      }
    }

    // Display reset time if available
    if (resetTime) {
      console.log(
        `${ConsoleWaitProgressReporter.CYAN}Quota resets at: ${formatResetTime(resetTime)}${ConsoleWaitProgressReporter.RESET}`,
      )
    }

    // Start the first tick
    tick()

    // Return cleanup function
    return () => {
      stopped = true
      // Clear the progress line and move to new line
      process.stdout.write('\r\x1b[K')
    }
  }
}
