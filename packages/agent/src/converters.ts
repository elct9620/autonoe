import type { McpServerConfig as SDKMcpServerConfig } from '@anthropic-ai/claude-agent-sdk'
import type {
  StreamEvent,
  AgentText,
  ToolInvocation,
  ToolResponse,
  SessionEnd,
  McpServer,
} from '@autonoe/core'
import {
  SessionOutcome,
  isQuotaExceededMessage,
  parseQuotaResetTime,
} from '@autonoe/core'

/**
 * SDK content block type definition
 */
interface SDKContentBlock {
  type: string
  text?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string | Array<{ type: string; text?: string }>
  is_error?: boolean
}

/**
 * SDK message type definition
 */
interface SDKMessage {
  type: string
  subtype?: string
  result?: string
  errors?: string[]
  total_cost_usd?: number
  message?: {
    content?: SDKContentBlock[]
  }
}

/**
 * Convert domain McpServer to SDK McpServerConfig
 */
export function toSdkMcpServers(
  mcpServers: Record<string, McpServer>,
): Record<string, SDKMcpServerConfig> {
  const result: Record<string, SDKMcpServerConfig> = {}
  for (const [name, server] of Object.entries(mcpServers)) {
    result[name] = {
      command: server.command,
      args: server.args,
    }
  }
  return result
}

/**
 * Convert SDK result subtype string to domain SessionOutcome
 * Detects quota exceeded from result text (SDK reports as 'success' with limit message)
 */
export function toSessionOutcome(
  subtype: string,
  resultText?: string,
): SessionOutcome {
  // Check for quota exceeded first (SDK reports as 'success' with limit message)
  if (resultText && isQuotaExceededMessage(resultText)) {
    return SessionOutcome.QuotaExceeded
  }

  switch (subtype) {
    case 'success':
      return SessionOutcome.Completed
    case 'error_max_turns':
      return SessionOutcome.MaxIterationsReached
    case 'error_during_execution':
      return SessionOutcome.ExecutionError
    case 'error_max_budget_usd':
      return SessionOutcome.BudgetExceeded
    case 'error_max_structured_output_retries':
      return SessionOutcome.ExecutionError
    default:
      return SessionOutcome.ExecutionError
  }
}

/**
 * Convert a single SDK content block to a StreamEvent
 * Returns null for unknown block types
 */
export function toStreamEvent(block: SDKContentBlock): StreamEvent | null {
  switch (block.type) {
    case 'text':
      return {
        type: 'agent_text',
        text: block.text ?? '',
      } as AgentText

    case 'tool_use':
      return {
        type: 'tool_invocation',
        name: block.name ?? '',
        input: block.input ?? {},
      } as ToolInvocation

    case 'tool_result': {
      // Normalize content: array of text blocks to single string
      let content = ''
      if (typeof block.content === 'string') {
        content = block.content
      } else if (Array.isArray(block.content)) {
        content = block.content.map((c) => c.text ?? '').join('')
      }
      return {
        type: 'tool_response',
        toolUseId: block.tool_use_id ?? '',
        content,
        isError: block.is_error ?? false,
      } as ToolResponse
    }

    default:
      return null
  }
}

/**
 * Convert SDK result message to SessionEnd
 * Detects quota exceeded and parses reset time if applicable
 */
export function toSessionEnd(sdkMessage: SDKMessage): SessionEnd {
  const outcome = toSessionOutcome(sdkMessage.subtype ?? '', sdkMessage.result)

  const sessionEnd: SessionEnd = {
    type: 'session_end',
    outcome,
    result: sdkMessage.result,
    errors: sdkMessage.errors,
    totalCostUsd: sdkMessage.total_cost_usd,
  }

  // Parse quota reset time if quota exceeded
  if (outcome === SessionOutcome.QuotaExceeded && sdkMessage.result) {
    sessionEnd.quotaResetTime =
      parseQuotaResetTime(sdkMessage.result) ?? undefined
  }

  return sessionEnd
}

/**
 * Flatten a single SDK message into multiple StreamEvents
 * SDK messages may contain multiple content blocks; this generator yields each as a separate event
 */
export function* toStreamEvents(
  sdkMessage: SDKMessage,
): Generator<StreamEvent> {
  // Handle result messages
  if (sdkMessage.type === 'result') {
    yield toSessionEnd(sdkMessage)
    return
  }

  // Handle text messages with content blocks
  if (sdkMessage.message?.content) {
    for (const block of sdkMessage.message.content) {
      const event = toStreamEvent(block)
      if (event !== null) {
        yield event
      }
    }
  }
}
