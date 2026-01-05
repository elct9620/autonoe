/**
 * Timer interface for abstracting delay operations
 * Enables dependency injection for testability
 * @see SPEC.md Section 3.9 SessionRunner
 */
export interface Timer {
  delay(ms: number): Promise<void>
}

/**
 * Real timer implementation using setTimeout
 * Used as default in production code
 */
export const realTimer: Timer = {
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}
