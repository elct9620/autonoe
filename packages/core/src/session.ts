import type { AgentClient } from './agentClient'
import { formatStreamEvent } from './eventFormatter'
import { silentLogger, type Logger } from './logger'
import { SessionOutcome } from './types'
import type { StreamEvent, SessionEnd } from './types'

/**
 * Session configuration options
 * @see SPEC.md Section 3.3
 */
export interface SessionOptions {
  projectDir: string
  model?: string
}

/**
 * Result of a session execution
 * @see SPEC.md Section 3.3
 */
export interface SessionResult {
  success: boolean
  costUsd: number
  duration: number
  deliverablesPassedCount: number
  deliverablesTotalCount: number
  outcome: SessionOutcome
  quotaResetTime?: Date
}

/**
 * Truncate string to specified length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str
}

/**
 * Session handles a single agent query execution
 * @see SPEC.md Section 3.3
 */
export class Session {
  constructor(private options: SessionOptions) {}

  /**
   * Run the session with an injected AgentClient, instruction, and Logger
   * @see SPEC.md Section 3.3, 3.7.2
   */
  async run(
    client: AgentClient,
    instruction: string,
    logger: Logger = silentLogger,
  ): Promise<SessionResult> {
    const startTime = Date.now()
    let costUsd = 0
    let outcome: SessionOutcome = SessionOutcome.Completed
    let quotaResetTime: Date | undefined
    let sessionEndReceived = false

    logger.debug(`[Send] ${truncate(instruction, 200)}`)

    const query = client.query(instruction)

    for await (const event of query) {
      logger.debug(
        `[Recv] ${event.type}: ${truncate(formatStreamEvent(event), 200)}`,
      )

      if (event.type === 'session_end') {
        sessionEndReceived = true
        if (event.totalCostUsd !== undefined) {
          costUsd = event.totalCostUsd
        }
        outcome = event.outcome
        quotaResetTime = event.quotaResetTime
        this.handleSessionEnd(event, logger)
      }

      if (event.type === 'stream_error') {
        if (sessionEndReceived) {
          // Error after session_end - expected for some outcomes (e.g., quota exceeded)
          logger.debug(`Stream error after session end: ${event.message}`)
        } else {
          // Error without session_end - this is a real error
          logger.error('Stream error', new Error(event.message))
          throw new Error(event.message)
        }
      }
    }

    return {
      success: outcome === SessionOutcome.Completed,
      costUsd,
      duration: Date.now() - startTime,
      deliverablesPassedCount: 0,
      deliverablesTotalCount: 0,
      outcome,
      quotaResetTime,
    }
  }

  /**
   * Handle session end event and display to user
   * @see SPEC.md Section 2.3 Domain Model
   */
  private handleSessionEnd(event: SessionEnd, logger: Logger): void {
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
