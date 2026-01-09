import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsoleLogger } from '../src/consoleLogger'

describe('ConsoleLogger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('info', () => {
    it('LOG-001: logs message with cyan color to stdout', () => {
      const logger = new ConsoleLogger()
      logger.info('test message')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test message'),
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[36m'),
      )
    })
  })

  describe('debug', () => {
    it('LOG-010: does not log when debug is disabled', () => {
      const logger = new ConsoleLogger({ debug: false })
      logger.debug('debug message')
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('LOG-011: logs message with gray color when debug is enabled', () => {
      const logger = new ConsoleLogger({ debug: true })
      logger.debug('debug message')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[debug]'),
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('debug message'),
      )
    })

    it('LOG-012: debug defaults to false', () => {
      const logger = new ConsoleLogger()
      logger.debug('debug message')
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('warn', () => {
    it('LOG-020: logs message with yellow color to stderr', () => {
      const logger = new ConsoleLogger()
      logger.warn('warning message')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('warning message'),
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[33m'),
      )
    })
  })

  describe('error', () => {
    it('LOG-030: logs message with red color to stderr', () => {
      const logger = new ConsoleLogger()
      logger.error('error message')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('error message'),
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[31m'),
      )
    })

    it('LOG-031: does not log stack trace when debug is disabled', () => {
      const logger = new ConsoleLogger({ debug: false })
      const error = new Error('test error')
      logger.error('error message', error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    })

    it('LOG-032: logs stack trace when debug is enabled', () => {
      const logger = new ConsoleLogger({ debug: true })
      const error = new Error('test error')
      logger.error('error message', error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
      expect(consoleErrorSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('Error:'),
      )
    })

    it('LOG-033: handles error without stack trace', () => {
      const logger = new ConsoleLogger({ debug: true })
      const error = new Error('test error')
      error.stack = undefined
      logger.error('error message', error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    })
  })
})
