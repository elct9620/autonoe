/**
 * Domain types for Autonoe
 * @see SPEC.md Section 2.3 Domain Model
 */

/**
 * SessionOutcome - literal type for outcome discrimination
 */
export type SessionOutcome =
  | 'completed'
  | 'max_iterations'
  | 'execution_error'
  | 'budget_exceeded'
  | 'quota_exceeded'

/**
 * SessionEnd variants - discriminated union by outcome
 * @see SPEC.md Section 2.3 Domain Model
 */

interface SessionEndBase {
  type: 'session_end'
  totalCostUsd?: number
}

export interface SessionEndCompleted extends SessionEndBase {
  outcome: 'completed'
  result?: string
}

export interface SessionEndExecutionError extends SessionEndBase {
  outcome: 'execution_error'
  messages: string[]
}

export interface SessionEndMaxIterations extends SessionEndBase {
  outcome: 'max_iterations'
}

export interface SessionEndBudgetExceeded extends SessionEndBase {
  outcome: 'budget_exceeded'
}

export interface SessionEndQuotaExceeded extends SessionEndBase {
  outcome: 'quota_exceeded'
  message?: string
  resetTime?: Date
}

// AgentText - Agent's text response
export interface AgentText {
  type: 'agent_text'
  text: string
}

// AgentThinking - Agent's thinking/reasoning content (summarized in Claude 4)
export interface AgentThinking {
  type: 'agent_thinking'
  thinking: string
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

// SessionEnd - discriminated union of all session end variants
export type SessionEnd =
  | SessionEndCompleted
  | SessionEndExecutionError
  | SessionEndMaxIterations
  | SessionEndBudgetExceeded
  | SessionEndQuotaExceeded

// StreamError - Error event from stream (SDK errors wrapped as events)
export interface StreamError {
  type: 'stream_error'
  message: string
  stack?: string
}

// StreamEvent - discriminated union of all event types
export type StreamEvent =
  | AgentText
  | AgentThinking
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
