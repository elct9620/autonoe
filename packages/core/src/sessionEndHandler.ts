import type { Logger } from './logger'
import type { SessionEnd } from './types'

/**
 * Interface for handling session end events
 * Separates outcome-specific logic from Session class
 */
export interface SessionEndHandler {
  handle(event: SessionEnd, logger: Logger): void
}

/**
 * Default implementation of SessionEndHandler
 * Logs session end events based on outcome
 */
export class DefaultSessionEndHandler implements SessionEndHandler {
  handle(event: SessionEnd, logger: Logger): void {
    switch (event.outcome) {
      case 'completed':
        if (event.result) {
          logger.info(event.result)
        }
        break
      case 'quota_exceeded':
        logger.warn('Quota exceeded: ' + (event.message ?? 'Unknown'))
        break
      case 'execution_error':
        for (const msg of event.messages) {
          logger.error(msg)
        }
        break
      // max_iterations and budget_exceeded have no special handling
    }
  }
}

/**
 * Silent handler that does nothing (useful for testing)
 */
export const silentSessionEndHandler: SessionEndHandler = {
  handle: () => {},
}
