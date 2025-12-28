import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'
import type {
  SDKMessage,
  Query as SDKQuery,
  Options as SDKOptions,
  McpServerConfig,
  PermissionMode,
} from '@anthropic-ai/claude-agent-sdk'
import { detectClaudeCodePath } from './claudeCodePath'

// Re-export SDK types for external use
export type { SDKMessage, McpServerConfig, PermissionMode }

/**
 * AgentClient interface for querying the Claude Agent
 * @see SPEC.md Section 3.1
 */
export interface AgentClient {
  query(message: string): Query
}

/**
 * Query interface extending AsyncGenerator with interrupt capability
 * @see SPEC.md Section 3.1
 */
export interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>
}

/**
 * Configuration options for creating a ClaudeAgentClient
 * @see SPEC.md Section 3.1
 */
export interface QueryOptions {
  cwd: string
  mcpServers?: Record<string, McpServerConfig>
  permissionMode?: PermissionMode
  allowedTools?: string[]
  systemPrompt?: string
}

/**
 * Real implementation of AgentClient that wraps the Claude Agent SDK
 */
export class ClaudeAgentClient implements AgentClient {
  private abortController: AbortController | null = null

  constructor(private options: QueryOptions) {}

  query(message: string): Query {
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
      sdkOptions.mcpServers = options.mcpServers
    }

    if (options.permissionMode) {
      sdkOptions.permissionMode = options.permissionMode
    }

    if (options.allowedTools) {
      sdkOptions.allowedTools = options.allowedTools
    }

    const sdkQueryResult: SDKQuery = sdkQuery({
      prompt: message,
      options: sdkOptions,
    })

    // The SDK's Query already has interrupt() method
    return sdkQueryResult as Query
  }
}
