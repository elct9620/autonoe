import { describe, it, expect, vi } from 'vitest'
import {
  DefaultSessionEndHandler,
  silentSessionEndHandler,
} from '../src/sessionEndHandler'
import { SessionOutcome } from '../src/types'
import type { SessionEnd } from '../src/types'
import type { Logger } from '../src/logger'

/**
 * SessionEndHandler Tests
 * Tests for session end event handling
 */

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

describe('DefaultSessionEndHandler', () => {
  const handler = new DefaultSessionEndHandler()

  describe('Completed outcome', () => {
    it('SEH-001: logs result when session completed with result', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.Completed,
        result: 'Task completed successfully',
      }

      handler.handle(event, logger)

      expect(logger.info).toHaveBeenCalledWith('Task completed successfully')
    })

    it('SEH-002: does not log when session completed without result', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.Completed,
      }

      handler.handle(event, logger)

      expect(logger.info).not.toHaveBeenCalled()
    })
  })

  describe('QuotaExceeded outcome', () => {
    it('SEH-010: logs warning with result message', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.QuotaExceeded,
        result: 'Rate limit reached',
      }

      handler.handle(event, logger)

      expect(logger.warn).toHaveBeenCalledWith(
        'Quota exceeded: Rate limit reached',
      )
    })

    it('SEH-011: logs warning with Unknown when no result', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.QuotaExceeded,
      }

      handler.handle(event, logger)

      expect(logger.warn).toHaveBeenCalledWith('Quota exceeded: Unknown')
    })
  })

  describe('Error outcomes', () => {
    it('SEH-020: logs each error for ExecutionError outcome', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.ExecutionError,
        errors: ['Error 1', 'Error 2'],
      }

      handler.handle(event, logger)

      expect(logger.error).toHaveBeenCalledTimes(2)
      expect(logger.error).toHaveBeenCalledWith('Error 1')
      expect(logger.error).toHaveBeenCalledWith('Error 2')
    })

    it('SEH-021: does not log when no errors array', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.ExecutionError,
      }

      handler.handle(event, logger)

      expect(logger.error).not.toHaveBeenCalled()
    })

    it('SEH-022: handles MaxIterationsReached outcome', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.MaxIterationsReached,
        errors: ['Max iterations reached'],
      }

      handler.handle(event, logger)

      expect(logger.error).toHaveBeenCalledWith('Max iterations reached')
    })

    it('SEH-023: handles BudgetExceeded outcome', () => {
      const logger = createMockLogger()
      const event: SessionEnd = {
        type: 'session_end',
        outcome: SessionOutcome.BudgetExceeded,
        errors: ['Budget exceeded'],
      }

      handler.handle(event, logger)

      expect(logger.error).toHaveBeenCalledWith('Budget exceeded')
    })
  })
})

describe('silentSessionEndHandler', () => {
  it('SEH-030: does not log anything', () => {
    const logger = createMockLogger()
    const event: SessionEnd = {
      type: 'session_end',
      outcome: SessionOutcome.Completed,
      result: 'Should not be logged',
    }

    silentSessionEndHandler.handle(event, logger)

    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.debug).not.toHaveBeenCalled()
  })
})
