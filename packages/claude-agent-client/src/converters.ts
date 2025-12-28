import type { McpServerConfig as SDKMcpServerConfig } from '@anthropic-ai/claude-agent-sdk'
import type { AgentMessage, McpServer } from '@autonoe/core'
import { AgentMessageType, ResultSubtype } from '@autonoe/core'

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
 * Convert SDK message type string to domain AgentMessageType
 */
export function toAgentMessageType(type: string): AgentMessageType {
  switch (type) {
    case 'text':
      return AgentMessageType.Text
    case 'result':
      return AgentMessageType.Result
    default:
      // For unknown types, default to Text
      return AgentMessageType.Text
  }
}

/**
 * Convert SDK result subtype string to domain ResultSubtype
 */
export function toResultSubtype(subtype: string): ResultSubtype {
  switch (subtype) {
    case 'success':
      return ResultSubtype.Success
    case 'error_max_turns':
      return ResultSubtype.ErrorMaxTurns
    case 'error_during_execution':
      return ResultSubtype.ErrorDuringExecution
    case 'error_max_budget_usd':
      return ResultSubtype.ErrorMaxBudgetUsd
    default:
      return ResultSubtype.ErrorDuringExecution
  }
}

/**
 * Convert SDK message to domain AgentMessage
 * Handles snake_case to camelCase conversion for ResultMessage fields
 */
export function toAgentMessage(sdkMessage: {
  type: string
  subtype?: string
  result?: string
  errors?: string[]
  total_cost_usd?: number
  [key: string]: unknown
}): AgentMessage {
  const type = toAgentMessageType(sdkMessage.type)

  if (type === AgentMessageType.Result) {
    return {
      type: AgentMessageType.Result,
      subtype: toResultSubtype(sdkMessage.subtype ?? ''),
      result: sdkMessage.result,
      errors: sdkMessage.errors,
      totalCostUsd: sdkMessage.total_cost_usd,
    } as AgentMessage
  }

  return {
    ...sdkMessage,
    type,
  } as AgentMessage
}
