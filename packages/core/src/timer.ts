/**
 * Timer interface for abstracting delay operations
 * Enables dependency injection for testability
 * @see SPEC.md Section 3.9 SessionRunner
 */
export interface Timer {
  delay(ms: number, signal?: AbortSignal): Promise<void>
}

/**
 * Real timer implementation using setTimeout
 * Used as default in production code
 * Supports AbortSignal for interruptible delays
 */
export const realTimer: Timer = {
  delay: (ms: number, signal?: AbortSignal) =>
    new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms)

      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId)
          reject(new DOMException('Aborted', 'AbortError'))
        },
        { once: true },
      )
    }),
}
