import type { AgentClient } from './agentClient'
import { silentLogger, type Logger } from './logger'
import { AgentMessageType, ResultSubtype } from './types'
import type { AgentMessage, ResultMessage } from './types'

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
      for await (const message of query) {
        logger.debug(`[Recv] ${message.type}: ${truncate(this.formatMessageContent(message), 200)}`)

        if (message.type === AgentMessageType.Result) {
          const resultMessage = message as ResultMessage
          if (resultMessage.totalCostUsd !== undefined) {
            costUsd = resultMessage.totalCostUsd
          }
          this.handleResultMessage(resultMessage, logger)
        }
      }
    } catch (error) {
      logger.error('Session query failed', error instanceof Error ? error : undefined)
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
   * Format message content for debug logging
   * @see SPEC.md Section 3.7.1
   */
  private formatMessageContent(message: AgentMessage): string {
    if (message.type === AgentMessageType.Result) {
      const resultMessage = message as ResultMessage
      if (resultMessage.result) {
        return resultMessage.result
      }
      if (resultMessage.errors?.length) {
        return resultMessage.errors.join(', ')
      }
      return resultMessage.subtype
    }
    // SDK messages have nested structure: message.message.content[]
    const sdkMessage = message as {
      message?: {
        content?: Array<{
          type: string
          text?: string
          name?: string
          input?: Record<string, unknown>
          content?: string | Array<{ type: string; text?: string }>
          tool_use_id?: string
          is_error?: boolean
        }>
      }
    }
    if (sdkMessage.message?.content) {
      return sdkMessage.message.content
        .map((block) => {
          if (block.type === 'text') return block.text ?? ''
          if (block.type === 'tool_use') {
            const input = block.input
              ? JSON.stringify(block.input).slice(0, 100)
              : ''
            return `[tool_use: ${block.name}] ${input}`
          }
          if (block.type === 'tool_result') {
            const error = block.is_error ? ' ERROR' : ''
            let content = ''
            if (typeof block.content === 'string') {
              content = block.content.slice(0, 100)
            } else if (Array.isArray(block.content)) {
              content = block.content
                .map((c) => c.text ?? '')
                .join('')
                .slice(0, 100)
            }
            return `[tool_result${error}] ${content}`
          }
          return `[${block.type}]`
        })
        .join(' ')
    }
    return ''
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
