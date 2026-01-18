import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsolePresenter } from '../src/consolePresenter'
import type { StreamEvent } from '@autonoe/core'

describe('ConsolePresenter', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
  }
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
    stdoutWriteSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    vi.useFakeTimers()
  })

  afterEach(() => {
    consoleSpy.log.mockRestore()
    consoleSpy.error.mockRestore()
    stdoutWriteSpy.mockRestore()
    vi.useRealTimers()
  })

  describe('lifecycle', () => {
    it('PRE-001: start() begins periodic updates', () => {
      const presenter = new ConsolePresenter({ updateIntervalMs: 100 })
      presenter.start()

      // Trigger thinking to set activity
      presenter.activity({ type: 'stream_thinking', thinking: 'test' })

      // Should render on activity
      expect(stdoutWriteSpy).toHaveBeenCalled()

      // Advance timer and check periodic render
      stdoutWriteSpy.mockClear()
      vi.advanceTimersByTime(100)
      expect(stdoutWriteSpy).toHaveBeenCalled()

      presenter.stop()
    })

    it('PRE-002: stop() clears interval and activity line', () => {
      const presenter = new ConsolePresenter({ updateIntervalMs: 100 })
      presenter.start()

      // Set activity
      presenter.activity({ type: 'stream_thinking', thinking: 'test' })

      presenter.stop()

      // Activity line should be cleared
      stdoutWriteSpy.mockClear()
      vi.advanceTimersByTime(200)
      // No more periodic updates after stop
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })

    it('PRE-003: start() resets state for new session', () => {
      const presenter = new ConsolePresenter()
      presenter.start()
      presenter.activity({ type: 'stream_thinking', thinking: 'test' })
      presenter.stop()

      // Start new session
      stdoutWriteSpy.mockClear()
      presenter.start()

      // State should be reset - idle state does not render
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
      presenter.stop()
    })

    it('PRE-004: stop() calls clearTimeout to cleanup timer', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const presenter = new ConsolePresenter({ updateIntervalMs: 100 })
      presenter.start()
      presenter.stop()
      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it('PRE-005: multiple start/stop cycles do not leak timers', () => {
      const presenter = new ConsolePresenter({ updateIntervalMs: 100 })
      presenter.start()
      presenter.activity({ type: 'stream_thinking', thinking: 'test' })
      presenter.stop()
      presenter.start()
      presenter.activity({
        type: 'stream_tool_invocation',
        name: 'Bash',
        input: {},
        toolUseId: 'id',
      })
      presenter.stop()
      stdoutWriteSpy.mockClear()
      vi.advanceTimersByTime(1000)
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })
  })

  describe('Logger methods', () => {
    it('PRE-010: info() logs cyan message', () => {
      const presenter = new ConsolePresenter()
      presenter.info('test message')

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('test message'),
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[36m'),
      ) // CYAN
    })

    it('PRE-011: debug() logs gray message when debug enabled', () => {
      const presenter = new ConsolePresenter({ debug: true })
      presenter.debug('debug message')

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[debug] debug message'),
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[90m'),
      ) // GRAY
    })

    it('PRE-012: debug() does not log when debug disabled', () => {
      const presenter = new ConsolePresenter({ debug: false })
      presenter.debug('debug message')

      expect(consoleSpy.log).not.toHaveBeenCalled()
    })

    it('PRE-013: warn() logs yellow message to stderr', () => {
      const presenter = new ConsolePresenter()
      presenter.warn('warning message')

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('warning message'),
      )
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[33m'),
      ) // YELLOW
    })

    it('PRE-014: error() logs red message to stderr', () => {
      const presenter = new ConsolePresenter()
      presenter.error('error message')

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('error message'),
      )
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[31m'),
      ) // RED
    })

    it('PRE-015: error() logs stack trace when debug enabled', () => {
      const presenter = new ConsolePresenter({ debug: true })
      const err = new Error('test error')
      presenter.error('error message', err)

      expect(consoleSpy.error).toHaveBeenCalledTimes(2)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('error message'),
      )
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: test error'),
      )
    })

    it('PRE-016: error() does not log stack trace when debug disabled', () => {
      const presenter = new ConsolePresenter({ debug: false })
      const err = new Error('test error')
      presenter.error('error message', err)

      expect(consoleSpy.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('Activity display', () => {
    it('PRE-020: thinking event shows "Thinking..."', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      presenter.activity({ type: 'stream_thinking', thinking: 'test' })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Thinking...'),
      )
      presenter.stop()
    })

    it('PRE-021: tool_invocation event shows tool name', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      const event: StreamEvent = {
        type: 'stream_tool_invocation',
        name: 'Bash',
        input: { command: 'ls' },
        toolUseId: 'test-id',
      }
      presenter.activity(event)

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running Bash...'),
      )
      presenter.stop()
    })

    it('PRE-022: tool_response increments tool count', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      // First tool invocation
      presenter.activity({
        type: 'stream_tool_invocation',
        name: 'Bash',
        input: {},
        toolUseId: 'id-1',
      })

      // Tool response
      presenter.activity({
        type: 'stream_tool_response',
        content: 'done',
        isError: false,
        toolUseId: 'id-1',
      })

      // Should show tool count
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 tool'),
      )
      presenter.stop()
    })

    it('PRE-023: multiple tool responses show plural', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      // Two tool cycles
      presenter.activity({
        type: 'stream_tool_invocation',
        name: 'Bash',
        input: {},
        toolUseId: 'id-1',
      })
      presenter.activity({
        type: 'stream_tool_response',
        content: 'done',
        isError: false,
        toolUseId: 'id-1',
      })
      presenter.activity({
        type: 'stream_tool_invocation',
        name: 'Read',
        input: {},
        toolUseId: 'id-2',
      })
      presenter.activity({
        type: 'stream_tool_response',
        content: 'done',
        isError: false,
        toolUseId: 'id-2',
      })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 tools'),
      )
      presenter.stop()
    })

    it('PRE-024: text event shows "Responding..."', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      presenter.activity({ type: 'stream_text', text: 'Hello' })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Responding...'),
      )
      presenter.stop()
    })

    it('PRE-025: waiting event shows remaining time', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      const resetTime = new Date()
      presenter.activity({
        type: 'stream_waiting',
        remainingMs: 60000,
        resetTime,
      })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Waiting...'),
      )
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('remaining'),
      )
      presenter.stop()
    })

    it('PRE-026: end event clears activity line', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      presenter.activity({ type: 'stream_thinking', thinking: 'test' })
      stdoutWriteSpy.mockClear()

      presenter.activity({
        type: 'stream_end',
        outcome: 'completed',
        result: 'done',
      })

      // Should clear activity line
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\r\x1b[K')
      presenter.stop()
    })

    it('PRE-027: error event does not change activity line', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      presenter.activity({ type: 'stream_thinking', thinking: 'test' })
      stdoutWriteSpy.mockClear()

      presenter.activity({
        type: 'stream_error',
        message: 'Connection failed',
      })

      // stream_error should not clear activity line (handled by Session lifecycle)
      // @see SPEC.md Section 3.5
      const clearCalls = stdoutWriteSpy.mock.calls.filter(
        (c: unknown[]) => c[0] === '\r\x1b[K',
      )
      expect(clearCalls.length).toBe(0)
      presenter.stop()
    })
  })

  describe('Output coordination', () => {
    it('PRE-030: info clears activity line before logging', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      // Set up activity line
      presenter.activity({ type: 'stream_thinking', thinking: 'test' })
      stdoutWriteSpy.mockClear()

      presenter.info('test message')

      // Should clear, log, then restore
      const calls = stdoutWriteSpy.mock.calls.map((c: unknown[]) => c[0])
      expect(calls[0]).toBe('\r\x1b[K') // Clear
      // Render is called after info to restore activity line
    })

    it('PRE-031: clearActivity() clears line when active', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      presenter.activity({ type: 'stream_thinking', thinking: 'test' })
      stdoutWriteSpy.mockClear()

      presenter.clearActivity()

      expect(stdoutWriteSpy).toHaveBeenCalledWith('\r\x1b[K')
      presenter.stop()
    })

    it('PRE-032: clearActivity() does nothing when no activity line', () => {
      const presenter = new ConsolePresenter()

      presenter.clearActivity()

      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })
  })

  describe('Elapsed time formatting', () => {
    it('PRE-040: formats elapsed time as M:SS', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      presenter.activity({ type: 'stream_thinking', thinking: 'test' })

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('0:00'),
      )

      stdoutWriteSpy.mockClear()
      vi.advanceTimersByTime(65000) // 1 minute 5 seconds

      // Trigger render via periodic update
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('1:05'),
      )
      presenter.stop()
    })
  })

  describe('Idle state', () => {
    it('PRE-050: does not render when idle', () => {
      const presenter = new ConsolePresenter()
      presenter.start()

      // No activity events, just timer
      vi.advanceTimersByTime(1000)

      // Should not render activity line for idle state
      const renderCalls = stdoutWriteSpy.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('\u26A1'),
      )
      expect(renderCalls.length).toBe(0)
      presenter.stop()
    })
  })
})
