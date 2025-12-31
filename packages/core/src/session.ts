import type { AgentClient } from './agentClient'
import { formatStreamEvent } from './eventFormatter'
import { silentLogger, type Logger } from './logger'
import { ResultSubtype } from './types'
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

    logger.debug(`[Send] ${truncate(instruction, 200)}`)

    const query = client.query(instruction)

    try {
      for await (const event of query) {
        logger.debug(
          `[Recv] ${event.type}: ${truncate(formatStreamEvent(event), 200)}`,
        )

        if (event.type === 'session_end') {
          if (event.totalCostUsd !== undefined) {
            costUsd = event.totalCostUsd
          }
          this.handleSessionEnd(event, logger)
        }
      }
    } catch (error) {
      logger.error(
        'Session query failed',
        error instanceof Error ? error : undefined,
      )
      throw error
    }

    return {
      success: true,
      costUsd,
      duration: Date.now() - startTime,
      deliverablesPassedCount: 0,
      deliverablesTotalCount: 0,
    }
  }

  /**
   * Handle session end event and display to user
   * @see SPEC.md Section 2.3 Domain Model
   */
  private handleSessionEnd(event: SessionEnd, logger: Logger): void {
    if (event.subtype === ResultSubtype.Success) {
      if (event.result) {
        logger.info(event.result)
      }
    } else if (event.errors) {
      for (const error of event.errors) {
        logger.error(error)
      }
    }
  }
}
