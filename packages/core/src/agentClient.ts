import type { MessageStream, McpServer, PermissionLevel } from './types'

/**
 * AgentClient interface for querying the Claude Agent
 * @see SPEC.md Section 3.1
 */
export interface AgentClient {
  query(instruction: string): MessageStream
}

/**
 * Constructor options for AgentClient implementations
 * @see SPEC.md Section 3.1
 */
export interface AgentClientOptions {
  cwd: string
  mcpServers?: Record<string, McpServer>
  permissionLevel?: PermissionLevel
  allowedTools?: string[]
}
