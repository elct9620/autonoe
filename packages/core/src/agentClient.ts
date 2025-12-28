import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'
import type {
  Query as SDKQuery,
  Options as SDKOptions,
  McpServerConfig as SDKMcpServerConfig,
  PermissionMode as SDKPermissionMode,
} from '@anthropic-ai/claude-agent-sdk'
import { detectClaudeCodePath } from './claudeCodePath'
import type {
  AgentMessage,
  MessageStream,
  McpServer,
  PermissionLevel,
} from './types'
import { AgentMessageType, ResultSubtype } from './types'

/**
 * AgentClient interface for querying the Claude Agent
 * @see SPEC.md Section 3.1
 */
export interface AgentClient {
  query(message: string): MessageStream
}

/**
 * Configuration options for creating a ClaudeAgentClient
 * @see SPEC.md Section 3.1
 */
export interface QueryOptions {
  cwd: string
  mcpServers?: Record<string, McpServer>
  permissionLevel?: PermissionLevel
  allowedTools?: string[]
  systemPrompt?: string
}

/**
 * Convert domain McpServer to SDK McpServerConfig
 */
function toSdkMcpServers(
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
function toAgentMessageType(type: string): AgentMessageType {
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
function toResultSubtype(subtype: string): ResultSubtype {
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
function toAgentMessage(sdkMessage: {
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

/**
 * Real implementation of AgentClient that wraps the Claude Agent SDK
 */
export class ClaudeAgentClient implements AgentClient {
  private abortController: AbortController | null = null

  constructor(private options: QueryOptions) {}

  query(message: string): MessageStream {
    this.abortController = new AbortController()
    const abortController = this.abortController
    const options = this.options

    const sdkOptions: SDKOptions = {
      cwd: options.cwd,
      abortController,
      pathToClaudeCodeExecutable: detectClaudeCodePath(),
    }

    if (options.systemPrompt) {
      sdkOptions.systemPrompt = options.systemPrompt
    }

    if (options.mcpServers) {
      sdkOptions.mcpServers = toSdkMcpServers(options.mcpServers)
    }

    if (options.permissionLevel) {
      sdkOptions.permissionMode = options.permissionLevel as SDKPermissionMode
    }

    if (options.allowedTools) {
      sdkOptions.allowedTools = options.allowedTools
    }

    const sdkQueryResult: SDKQuery = sdkQuery({
      prompt: message,
      options: sdkOptions,
    })

    // Wrap SDK query to convert messages to domain types
    return this.wrapSdkQuery(sdkQueryResult)
  }

  /**
   * Wrap SDK Query to convert SDK messages to domain AgentMessages
   */
  private wrapSdkQuery(sdkQuery: SDKQuery): MessageStream {
    const generator = (async function* () {
      for await (const sdkMessage of sdkQuery) {
        yield toAgentMessage(sdkMessage)
      }
    })()

    const stream = generator as MessageStream
    stream.interrupt = () => sdkQuery.interrupt()

    return stream
  }
}
