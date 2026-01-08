import type { Logger } from './logger'
import type { StreamEventEnd } from './types'

/**
 * Logs session end events based on outcome
 * @see SPEC.md Section 3.3
 */
export function logSessionEnd(event: StreamEventEnd, logger: Logger): void {
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
