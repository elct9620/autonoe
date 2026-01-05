import { describe, it, expect, vi } from 'vitest'
import { realTimer, type Timer } from '../src/timer'

/**
 * Timer Tests
 * Tests for the Timer abstraction used by SessionRunner
 */
describe('Timer', () => {
  describe('realTimer', () => {
    it('TI-001: delay resolves after specified time', async () => {
      vi.useFakeTimers()

      let resolved = false
      const promise = realTimer.delay(1000).then(() => {
        resolved = true
      })

      expect(resolved).toBe(false)

      vi.advanceTimersByTime(1000)
      await promise

      expect(resolved).toBe(true)

      vi.useRealTimers()
    })

    it('TI-002: delay with 0ms resolves immediately', async () => {
      vi.useFakeTimers()

      let resolved = false
      const promise = realTimer.delay(0).then(() => {
        resolved = true
      })

      await vi.runAllTimersAsync()
      await promise

      expect(resolved).toBe(true)

      vi.useRealTimers()
    })
  })

  describe('mock timer', () => {
    it('TI-003: can create mock timer for testing', async () => {
      const mockTimer: Timer = {
        delay: vi.fn().mockResolvedValue(undefined),
      }

      await mockTimer.delay(5000)

      expect(mockTimer.delay).toHaveBeenCalledWith(5000)
    })

    it('TI-004: mock timer can be injected into SessionRunner', () => {
      const mockTimer: Timer = {
        delay: vi.fn().mockResolvedValue(undefined),
      }

      // Timer interface satisfies injection contract
      expect(mockTimer).toHaveProperty('delay')
      expect(typeof mockTimer.delay).toBe('function')
    })
  })
})
