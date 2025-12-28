import type { MessageStream, McpServer, PermissionLevel } from './types'

/**
 * AgentClient interface for querying the Claude Agent
 * @see SPEC.md Section 3.1
 */
export interface AgentClient {
  query(message: string): MessageStream
}

/**
 * Configuration options for creating an AgentClient
 * @see SPEC.md Section 3.1
 */
export interface QueryOptions {
  cwd: string
  mcpServers?: Record<string, McpServer>
  permissionLevel?: PermissionLevel
  allowedTools?: string[]
  systemPrompt?: string
}
