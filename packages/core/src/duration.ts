/**
 * Duration formatting utilities
 * @see SPEC.md Section 3.8.2
 */

/**
 * Format a duration in milliseconds to a human-readable string
 * Zero-value parts are omitted (e.g., 1h, 1m 30s, 5s)
 *
 * @param ms - Duration in milliseconds
 * @returns Human-readable duration string
 *
 * @example
 * formatDuration(3661000) // "1h 1m 1s"
 * formatDuration(3600000) // "1h"
 * formatDuration(90000)   // "1m 30s"
 * formatDuration(5000)    // "5s"
 * formatDuration(0)       // "0s"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }

  if (seconds > 0 || (hours === 0 && minutes === 0)) {
    parts.push(`${seconds}s`)
  }

  return parts.join(' ')
}
