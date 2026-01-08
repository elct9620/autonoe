import type { AgentClient } from './agentClient'
import { formatStreamEvent, truncate } from './eventFormatter'
import { silentLogger, type Logger } from './logger'
import { logSessionEnd } from './sessionEndHandler'
import type { SessionOutcome } from './types'

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
  costUsd: number
  duration: number
  outcome: SessionOutcome
  quotaResetTime?: Date
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
    let outcome: SessionOutcome = 'completed'
    let quotaResetTime: Date | undefined
    let sessionEndReceived = false

    logger.debug(`[Send] ${truncate(instruction, 200)}`)

    const query = client.query(instruction)

    try {
      for await (const event of query) {
        logger.debug(
          `[Recv] ${event.type}: ${truncate(formatStreamEvent(event), 200)}`,
        )

        if (event.type === 'stream_end') {
          sessionEndReceived = true
          if (event.totalCostUsd !== undefined) {
            costUsd = event.totalCostUsd
          }
          outcome = event.outcome
          quotaResetTime =
            event.outcome === 'quota_exceeded' ? event.resetTime : undefined
          logSessionEnd(event, logger)
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
    } finally {
      await client.dispose()
    }

    return {
      costUsd,
      duration: Date.now() - startTime,
      outcome,
      quotaResetTime,
    }
  }
}
