import type { MessageStream, McpServer, PermissionLevel } from './types'
import type { SandboxConfig } from './configuration'

/**
 * AgentClient interface for querying the Claude Agent
 * @see SPEC.md Section 3.1
 */
export interface AgentClient {
  query(instruction: string): MessageStream
  dispose(): Promise<void>
}

/**
 * Factory for creating fresh AgentClient instances per session
 * @see SPEC.md Section 3.9.3
 */
export interface AgentClientFactory {
  create(): AgentClient
}

/**
 * Input for PreToolUse hook callback
 */
export type PreToolUseInput = {
  toolName: string
  toolInput: Record<string, unknown>
}

/**
 * Result from PreToolUse hook callback
 */
export type HookResult = {
  continue: boolean
  decision?: 'approve' | 'block'
  reason?: string
}

/**
 * PreToolUse hook definition
 * @see SPEC.md Section 3.6
 */
export interface PreToolUseHook {
  name: string
  matcher?: string
  callback: (input: PreToolUseInput) => Promise<HookResult>
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
  sandbox?: SandboxConfig
  preToolUseHooks?: PreToolUseHook[]
  model?: string
  maxThinkingTokens?: number
}
