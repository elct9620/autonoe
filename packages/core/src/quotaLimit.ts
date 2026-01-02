/**
 * Quota limit detection and handling utilities
 * @see SPEC.md Section 3.9
 */

const QUOTA_PATTERN = /You've hit your limit/i
const RESET_TIME_PATTERN = /resets?\s+(\d{1,2})(am|pm)\s*\(UTC\)/i

/**
 * Check if a message indicates quota has been exceeded
 */
export function isQuotaExceededMessage(text: string): boolean {
  return QUOTA_PATTERN.test(text)
}

/**
 * Parse the quota reset time from a message
 * @returns Date object for reset time in UTC, or null if not found
 */
export function parseQuotaResetTime(text: string): Date | null {
  const match = text.match(RESET_TIME_PATTERN)
  if (!match || !match[1] || !match[2]) return null

  const hour = parseInt(match[1], 10)
  const isPM = match[2].toLowerCase() === 'pm'

  const now = new Date()
  let resetHour: number

  if (isPM && hour !== 12) {
    resetHour = hour + 12
  } else if (!isPM && hour === 12) {
    resetHour = 0
  } else {
    resetHour = hour
  }

  const resetTime = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      resetHour,
      0,
      0,
      0,
    ),
  )

  // If reset time is in the past, assume next day
  if (resetTime <= now) {
    resetTime.setUTCDate(resetTime.getUTCDate() + 1)
  }

  return resetTime
}

/**
 * Calculate the duration to wait until the reset time
 * @returns Duration in milliseconds
 */
export function calculateWaitDuration(resetTime: Date): number {
  return Math.max(0, resetTime.getTime() - Date.now())
}
