/**
 * Domain types for Autonoe
 * @see SPEC.md Section 2.3 Domain Model
 */

/**
 * SessionOutcome - domain-specific session result outcomes
 * Decoupled from SDK subtypes for clean architecture
 * @see SPEC.md Section 2.3 Domain Model
 */
export enum SessionOutcome {
  Completed = 'completed',
  MaxIterationsReached = 'max_iterations',
  ExecutionError = 'execution_error',
  BudgetExceeded = 'budget_exceeded',
  QuotaExceeded = 'quota_exceeded',
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
  outcome: SessionOutcome
  result?: string
  errors?: string[]
  totalCostUsd?: number
  quotaResetTime?: Date
}

// StreamError - Error event from stream (SDK errors wrapped as events)
export interface StreamError {
  type: 'stream_error'
  message: string
  stack?: string
}

// StreamEvent - discriminated union of all event types
export type StreamEvent =
  | AgentText
  | ToolInvocation
  | ToolResponse
  | SessionEnd
  | StreamError

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
