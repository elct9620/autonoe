import { describe, it, expect, vi } from 'vitest'
import { logSessionEnd } from '../src/sessionEndHandler'
import type { StreamEventEnd } from '../src/types'
import type { Logger } from '../src/logger'

/**
 * logSessionEnd Tests
 * Tests for session end event logging
 */

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

describe('logSessionEnd', () => {
  describe('Completed outcome', () => {
    it('SEH-001: logs result when session completed with result', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'completed',
        result: 'Task completed successfully',
      }

      logSessionEnd(event, logger)

      expect(logger.info).toHaveBeenCalledWith('Task completed successfully')
    })

    it('SEH-002: does not log when session completed without result', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'completed',
      }

      logSessionEnd(event, logger)

      expect(logger.info).not.toHaveBeenCalled()
    })
  })

  describe('QuotaExceeded outcome', () => {
    it('SEH-010: logs warning with message', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'quota_exceeded',
        message: 'Rate limit reached',
      }

      logSessionEnd(event, logger)

      expect(logger.warn).toHaveBeenCalledWith(
        'Quota exceeded: Rate limit reached',
      )
    })

    it('SEH-011: logs warning with Unknown when no message', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'quota_exceeded',
      }

      logSessionEnd(event, logger)

      expect(logger.warn).toHaveBeenCalledWith('Quota exceeded: Unknown')
    })
  })

  describe('ExecutionError outcome', () => {
    it('SEH-020: logs each error message', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'execution_error',
        messages: ['Error 1', 'Error 2'],
      }

      logSessionEnd(event, logger)

      expect(logger.error).toHaveBeenCalledTimes(2)
      expect(logger.error).toHaveBeenCalledWith('Error 1')
      expect(logger.error).toHaveBeenCalledWith('Error 2')
    })

    it('SEH-021: handles empty messages array', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'execution_error',
        messages: [],
      }

      logSessionEnd(event, logger)

      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('MaxIterations outcome', () => {
    it('SEH-022: handles max_iterations without special logging', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'max_iterations',
      }

      logSessionEnd(event, logger)

      // max_iterations has no special handling
      expect(logger.info).not.toHaveBeenCalled()
      expect(logger.warn).not.toHaveBeenCalled()
      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('BudgetExceeded outcome', () => {
    it('SEH-023: handles budget_exceeded without special logging', () => {
      const logger = createMockLogger()
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'budget_exceeded',
      }

      logSessionEnd(event, logger)

      // budget_exceeded has no special handling
      expect(logger.info).not.toHaveBeenCalled()
      expect(logger.warn).not.toHaveBeenCalled()
      expect(logger.error).not.toHaveBeenCalled()
    })
  })
})
