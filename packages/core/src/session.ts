import type { AgentClient } from './agentClient'
import { silentLogger, type Logger } from './logger'
import { AgentMessageType, ResultSubtype } from './types'
import type { ResultMessage } from './types'

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
 * Session handles a single agent query execution
 * @see SPEC.md Section 3.3
 */
export class Session {
  constructor(private options: SessionOptions) {}

  /**
   * Run the session with an injected AgentClient, instruction, and Logger
   * @see SPEC.md Section 3.3
   */
  async run(
    client: AgentClient,
    instruction: string,
    logger: Logger = silentLogger,
  ): Promise<SessionResult> {
    const startTime = Date.now()
    let costUsd = 0

    logger.debug(`Sending instruction`)

    const query = client.query(instruction)

    for await (const message of query) {
      logger.debug(`Received: ${message.type}`)

      if (message.type === AgentMessageType.Result) {
        const resultMessage = message as ResultMessage
        if (resultMessage.totalCostUsd !== undefined) {
          costUsd = resultMessage.totalCostUsd
        }
        this.handleResultMessage(resultMessage, logger)
      }
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
   * Handle result message and display to user
   * @see SPEC.md Section 2.3 Domain Model
   */
  private handleResultMessage(message: ResultMessage, logger: Logger): void {
    if (message.subtype === ResultSubtype.Success) {
      if (message.result) {
        logger.info(message.result)
      }
    } else if (message.errors) {
      for (const error of message.errors) {
        logger.error(error)
      }
    }
  }
}
