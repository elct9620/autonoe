import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsoleActivityReporter } from '../src/consoleActivityReporter'

describe('ConsoleActivityReporter', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    stdoutWriteSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    stdoutWriteSpy.mockRestore()
  })

  describe('constructor', () => {
    it('AR-001: uses default updateIntervalMs of 1000', () => {
      const reporter = new ConsoleActivityReporter()
      expect(reporter['updateIntervalMs']).toBe(1000)
    })

    it('AR-002: accepts custom updateIntervalMs', () => {
      const reporter = new ConsoleActivityReporter({ updateIntervalMs: 500 })
      expect(reporter['updateIntervalMs']).toBe(500)
    })
  })

  describe('startSession', () => {
    it('AR-010: returns a cleanup function', () => {
      const reporter = new ConsoleActivityReporter()
      const cleanup = reporter.startSession()
      expect(typeof cleanup).toBe('function')
      cleanup()
    })

    it('AR-011: cleanup clears the activity line', () => {
      const reporter = new ConsoleActivityReporter()
      const cleanup = reporter.startSession()

      reporter.reportActivity({ type: 'thinking', elapsedMs: 1000 })
      stdoutWriteSpy.mockClear()

      cleanup()

      expect(stdoutWriteSpy).toHaveBeenCalledWith('\r\x1b[K')
    })

    it('AR-012: cleanup stops periodic updates', () => {
      const reporter = new ConsoleActivityReporter({ updateIntervalMs: 100 })
      const cleanup = reporter.startSession()

      reporter.reportActivity({ type: 'thinking', elapsedMs: 1000 })
      cleanup()
      stdoutWriteSpy.mockClear()

      vi.advanceTimersByTime(200)

      // No additional writes after cleanup (only the initial cleanup write)
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })
  })

  describe('reportActivity', () => {
    it('AR-020: displays thinking activity', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      reporter.reportActivity({ type: 'thinking', elapsedMs: 5000 })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Thinking...'),
      )
    })

    it('AR-021: displays tool activity with tool name', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      reporter.reportActivity({
        type: 'tool_start',
        toolName: 'bash',
        elapsedMs: 10000,
      })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running bash...'),
      )
    })

    it('AR-022: increments tool count on tool_complete', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      reporter.reportActivity({
        type: 'tool_start',
        toolName: 'bash',
        elapsedMs: 10000,
      })
      reporter.reportActivity({
        type: 'tool_complete',
        toolName: 'bash',
        isError: false,
        elapsedMs: 11000,
      })
      reporter.reportActivity({
        type: 'tool_start',
        toolName: 'Read',
        elapsedMs: 12000,
      })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('(1 tool)'),
      )
    })

    it('AR-023: displays responding activity', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      reporter.reportActivity({ type: 'responding', elapsedMs: 15000 })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Responding...'),
      )
    })

    it('AR-024: displays waiting activity with remaining time', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()
      const resetTime = new Date(Date.now() + 3600000)

      reporter.reportActivity({
        type: 'waiting',
        remainingMs: 3600000,
        resetTime,
        elapsedMs: 20000,
      })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Waiting...'),
      )
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('remaining'),
      )
    })

    it('AR-025: formats elapsed time as M:SS', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      // 1 minute and 23 seconds = 83000ms
      reporter.reportActivity({ type: 'thinking', elapsedMs: 83000 })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('1:23'),
      )
    })

    it('AR-026: uses cyan color for output', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      reporter.reportActivity({ type: 'thinking', elapsedMs: 1000 })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[36m'),
      )
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[0m'),
      )
    })

    it('AR-027: shows tool count plural for multiple tools', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      reporter.reportActivity({
        type: 'tool_complete',
        toolName: 'bash',
        isError: false,
        elapsedMs: 1000,
      })
      reporter.reportActivity({
        type: 'tool_complete',
        toolName: 'Read',
        isError: false,
        elapsedMs: 2000,
      })
      reporter.reportActivity({
        type: 'tool_complete',
        toolName: 'Write',
        isError: false,
        elapsedMs: 3000,
      })
      reporter.reportActivity({
        type: 'responding',
        elapsedMs: 4000,
      })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('(3 tools)'),
      )
    })

    it('AR-028: uses lightning emoji for activity', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()

      reporter.reportActivity({ type: 'thinking', elapsedMs: 1000 })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\u26A1'),
      )
    })

    it('AR-029: uses hourglass emoji for waiting', () => {
      const reporter = new ConsoleActivityReporter()
      reporter.startSession()
      const resetTime = new Date(Date.now() + 60000)

      reporter.reportActivity({
        type: 'waiting',
        remainingMs: 60000,
        resetTime,
        elapsedMs: 1000,
      })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('\u23F3'),
      )
    })
  })

  describe('periodic updates', () => {
    it('AR-030: updates display at interval', () => {
      const reporter = new ConsoleActivityReporter({ updateIntervalMs: 100 })
      reporter.startSession()

      reporter.reportActivity({ type: 'thinking', elapsedMs: 1000 })
      stdoutWriteSpy.mockClear()

      vi.advanceTimersByTime(100)

      expect(stdoutWriteSpy).toHaveBeenCalled()
    })
  })
})
