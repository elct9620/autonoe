import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { delay } from '../src/delay'

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('DL-D001: resolves after specified time', async () => {
    let resolved = false
    const promise = delay(1000).then(() => {
      resolved = true
    })

    expect(resolved).toBe(false)

    vi.advanceTimersByTime(1000)
    await promise

    expect(resolved).toBe(true)
  })

  it('DL-D002: resolves immediately with 0ms', async () => {
    let resolved = false
    const promise = delay(0).then(() => {
      resolved = true
    })

    await vi.runAllTimersAsync()
    await promise

    expect(resolved).toBe(true)
  })

  it('DL-D003: rejects with AbortError when signal is aborted', async () => {
    const controller = new AbortController()

    const promise = delay(10000, controller.signal)

    // Abort immediately
    controller.abort()

    await expect(promise).rejects.toThrow('Aborted')
    await expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('DL-D004: clears timeout when aborted', async () => {
    const controller = new AbortController()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const promise = delay(10000, controller.signal)

    controller.abort()

    try {
      await promise
    } catch {
      // Expected to reject
    }

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('DL-D005: works without signal parameter', async () => {
    const promise = delay(100)

    vi.advanceTimersByTime(100)
    await promise

    // Should resolve without error
    expect(true).toBe(true)
  })
})
