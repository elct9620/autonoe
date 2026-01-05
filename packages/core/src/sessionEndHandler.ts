import type { Logger } from './logger'
import type { SessionEnd } from './types'
import { SessionOutcome } from './types'

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
      case SessionOutcome.Completed:
        if (event.result) {
          logger.info(event.result)
        }
        break
      case SessionOutcome.QuotaExceeded:
        logger.warn('Quota exceeded: ' + (event.result ?? 'Unknown'))
        break
      default:
        if (event.errors) {
          for (const error of event.errors) {
            logger.error(error)
          }
        }
    }
  }
}

/**
 * Silent handler that does nothing (useful for testing)
 */
export const silentSessionEndHandler: SessionEndHandler = {
  handle: () => {},
}
