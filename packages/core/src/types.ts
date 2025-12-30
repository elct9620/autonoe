/**
 * Domain types for Autonoe
 * @see SPEC.md Section 2.3 Domain Model
 */

// ResultSubtype - enum for session result outcomes
export enum ResultSubtype {
  Success = 'success',
  ErrorMaxTurns = 'error_max_turns',
  ErrorDuringExecution = 'error_during_execution',
  ErrorMaxBudgetUsd = 'error_max_budget_usd',
}

// AgentText - Agent's text response
export interface AgentText {
  type: 'agent_text'
  text: string
}

// ToolInvocation - Agent's tool call request
export interface ToolInvocation {
  type: 'tool_invocation'
  name: string
  input: Record<string, unknown>
}

// ToolResponse - Tool execution result (returned to Agent)
export interface ToolResponse {
  type: 'tool_response'
  toolUseId: string
  content: string
  isError: boolean
}

// SessionEnd - Session termination state
export interface SessionEnd {
  type: 'session_end'
  subtype: ResultSubtype
  result?: string
  errors?: string[]
  totalCostUsd?: number
}

// StreamEvent - discriminated union of all event types
export type StreamEvent = AgentText | ToolInvocation | ToolResponse | SessionEnd

// MessageStream - async generator yielding StreamEvents with interrupt capability
export interface MessageStream extends AsyncGenerator<StreamEvent, void> {
  interrupt(): Promise<void>
}

// McpServer - external tool server configuration
export interface McpServer {
  command: string
  args?: string[]
}

// PermissionLevel - security permission level
export type PermissionLevel = 'default' | 'acceptEdits' | 'bypassPermissions'
