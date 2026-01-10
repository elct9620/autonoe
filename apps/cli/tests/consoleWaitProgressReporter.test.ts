import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsoleWaitProgressReporter } from '../src/consoleWaitProgressReporter'

describe('ConsoleWaitProgressReporter', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutWriteSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    consoleLogSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  describe('constructor', () => {
    it('WPR-001: uses default updateIntervalMs of 60000', () => {
      const reporter = new ConsoleWaitProgressReporter()
      expect(reporter['updateIntervalMs']).toBe(60000)
    })

    it('WPR-002: accepts custom updateIntervalMs', () => {
      const reporter = new ConsoleWaitProgressReporter({
        updateIntervalMs: 5000,
      })
      expect(reporter['updateIntervalMs']).toBe(5000)
    })
  })

  describe('startWait', () => {
    it('WPR-010: displays reset time when provided', () => {
      const reporter = new ConsoleWaitProgressReporter()
      const resetTime = new Date('2024-01-01T18:00:00Z')

      reporter.startWait(60000, resetTime)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Quota resets at:'),
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[36m'),
      )
    })

    it('WPR-011: does not display reset time when not provided', () => {
      const reporter = new ConsoleWaitProgressReporter()

      reporter.startWait(60000)

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('WPR-012: writes progress message with remaining time', () => {
      const reporter = new ConsoleWaitProgressReporter()

      reporter.startWait(120000) // 2 minutes

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Waiting...'),
      )
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('remaining'),
      )
    })

    it('WPR-013: updates progress after interval', () => {
      const reporter = new ConsoleWaitProgressReporter({
        updateIntervalMs: 1000,
      })

      reporter.startWait(5000)
      stdoutWriteSpy.mockClear()

      vi.advanceTimersByTime(1000)

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Waiting...'),
      )
    })

    it('WPR-014: stops updating when cleanup is called', () => {
      const reporter = new ConsoleWaitProgressReporter({
        updateIntervalMs: 1000,
      })

      const cleanup = reporter.startWait(10000)
      stdoutWriteSpy.mockClear()

      cleanup()
      vi.advanceTimersByTime(2000)

      // Only the cleanup write should have been called
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1)
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\r\x1b[K')
    })

    it('WPR-015: cleanup clears the progress line', () => {
      const reporter = new ConsoleWaitProgressReporter()

      const cleanup = reporter.startWait(60000)
      stdoutWriteSpy.mockClear()

      cleanup()

      expect(stdoutWriteSpy).toHaveBeenCalledWith('\r\x1b[K')
    })

    it('WPR-016: stops ticking when remaining time is zero', () => {
      const reporter = new ConsoleWaitProgressReporter({
        updateIntervalMs: 100,
      })

      reporter.startWait(150)

      // First tick happens immediately
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1)
      stdoutWriteSpy.mockClear()

      // Advance to trigger second tick (100ms interval)
      vi.advanceTimersByTime(100)

      // Second tick should happen (remaining ~50ms)
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1)
      stdoutWriteSpy.mockClear()

      // Advance again - now remaining is negative, should not tick
      vi.advanceTimersByTime(100)

      // No more ticks after time is up
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })

    it('WPR-017: returns a cleanup function', () => {
      const reporter = new ConsoleWaitProgressReporter()

      const cleanup = reporter.startWait(60000)

      expect(typeof cleanup).toBe('function')
    })

    it('WPR-018: includes emoji in progress message', () => {
      const reporter = new ConsoleWaitProgressReporter()

      reporter.startWait(60000)

      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('⏳'))
    })

    it('WPR-019: uses cyan color for output', () => {
      const reporter = new ConsoleWaitProgressReporter()

      reporter.startWait(60000)

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[36m'),
      )
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[0m'),
      )
    })
  })
})
