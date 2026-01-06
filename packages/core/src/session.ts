import type { AgentClient } from './agentClient'
import { formatStreamEvent, truncate } from './eventFormatter'
import { silentLogger, type Logger } from './logger'
import type { SessionOutcome } from './types'
import type { SessionEndHandler } from './sessionEndHandler'
import { DefaultSessionEndHandler } from './sessionEndHandler'

/**
 * Session configuration options
 * @see SPEC.md Section 3.3
 */
export interface SessionOptions {
  projectDir: string
  model?: string
  /** Handler for session end events (default: DefaultSessionEndHandler) */
  sessionEndHandler?: SessionEndHandler
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
 * Session handles a single agent query execution
 * @see SPEC.md Section 3.3
 */
export class Session {
  private readonly sessionEndHandler: SessionEndHandler

  constructor(private options: SessionOptions) {
    this.sessionEndHandler =
      options.sessionEndHandler ?? new DefaultSessionEndHandler()
  }

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
    let outcome: SessionOutcome = 'completed'
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
        quotaResetTime =
          event.outcome === 'quota_exceeded' ? event.resetTime : undefined
        this.sessionEndHandler.handle(event, logger)
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
      success: outcome === 'completed',
      costUsd,
      duration: Date.now() - startTime,
      deliverablesPassedCount: 0,
      deliverablesTotalCount: 0,
      outcome,
      quotaResetTime,
    }
  }
}
