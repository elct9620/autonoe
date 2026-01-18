import type { Delay } from '@autonoe/core'

/**
 * Production delay implementation using setTimeout
 * Supports AbortSignal for interruptible waits (e.g., SIGINT during quota wait)
 */
export const delay: Delay = (ms: number, signal?: AbortSignal) =>
  new Promise((resolve, reject) => {
    const abortHandler = () => {
      clearTimeout(timeoutId)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', abortHandler)
      resolve()
    }, ms)

    signal?.addEventListener('abort', abortHandler, { once: true })
  })
