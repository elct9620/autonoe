import type { ActivityCallback } from './activityReporter'
import type { AgentClient } from './agentClient'
import { formatStreamEvent, truncate } from './eventFormatter'
import { silentLogger, type Logger } from './logger'
import { logSessionEnd } from './sessionEndHandler'
import type { SessionOutcome, StreamEvent } from './types'

/**
 * Result of a session execution
 * Discriminated union: success or failure
 * @see SPEC.md Section 3.3
 */
export type SessionResult =
  | {
      success: true
      costUsd: number
      duration: number
      outcome: SessionOutcome
      quotaResetTime?: Date
    }
  | {
      success: false
      error: string
      duration: number
    }

/**
 * Session handles a single agent query execution
 * Stateless service - configuration belongs to AgentClient
 * @see SPEC.md Section 3.3
 */
export class Session {
  /** Map toolUseId to toolName for activity reporting */
  private toolNameMap = new Map<string, string>()

  /**
   * Run the session with an injected AgentClient, instruction, and Logger
   * @param client - AgentClient to use for the query
   * @param instruction - The instruction to send to the agent
   * @param logger - Logger for debug/info messages
   * @param onActivity - Optional callback for activity reporting
   * @see SPEC.md Section 3.3, 3.5, 3.7.2
   */
  async run(
    client: AgentClient,
    instruction: string,
    logger: Logger = silentLogger,
    onActivity?: ActivityCallback,
  ): Promise<SessionResult> {
    const startTime = Date.now()
    let costUsd = 0
    let outcome: SessionOutcome = 'completed'
    let quotaResetTime: Date | undefined
    let sessionEndReceived = false

    // Reset tool name map for new session
    this.toolNameMap.clear()

    logger.debug(`[Send] ${truncate(instruction, 200)}`)

    const query = client.query(instruction)

    try {
      for await (const event of query) {
        logger.debug(
          `[Recv] ${event.type}: ${truncate(formatStreamEvent(event), 200)}`,
        )

        // Report activity if callback is provided
        if (onActivity) {
          this.reportActivity(event, onActivity)
        }

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
            return {
              success: false,
              error: event.message,
              duration: Date.now() - startTime,
            }
          }
        }
      }
    } finally {
      await client.dispose()
    }

    return {
      success: true,
      costUsd,
      duration: Date.now() - startTime,
      outcome,
      quotaResetTime,
    }
  }

  /**
   * Convert StreamEvent to RawActivityEvent and invoke callback
   * @see SPEC.md Section 3.5 StreamEvent to ActivityEvent Mapping
   */
  private reportActivity(
    event: StreamEvent,
    onActivity: ActivityCallback,
  ): void {
    switch (event.type) {
      case 'stream_thinking':
        onActivity({ type: 'thinking' })
        break

      case 'stream_tool_invocation':
        this.toolNameMap.set(event.toolUseId, event.name)
        onActivity({ type: 'tool_start', toolName: event.name })
        break

      case 'stream_tool_response': {
        const toolName =
          this.toolNameMap.get(event.toolUseId) ?? event.toolUseId
        onActivity({
          type: 'tool_complete',
          toolName,
          isError: event.isError,
        })
        break
      }

      case 'stream_text':
        onActivity({ type: 'responding' })
        break

      // stream_end and stream_error don't generate activity events
      // (handled by SessionRunner lifecycle)
    }
  }
}
