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
 * StreamEventEnd variants - discriminated union by outcome
 * @see SPEC.md Section 2.3 Domain Model
 */

interface StreamEventEndBase {
  type: 'stream_end'
  totalCostUsd?: number
}

export interface StreamEventEndCompleted extends StreamEventEndBase {
  outcome: 'completed'
  result?: string
}

export interface StreamEventEndExecutionError extends StreamEventEndBase {
  outcome: 'execution_error'
  messages: string[]
}

export interface StreamEventEndMaxIterations extends StreamEventEndBase {
  outcome: 'max_iterations'
}

export interface StreamEventEndBudgetExceeded extends StreamEventEndBase {
  outcome: 'budget_exceeded'
}

export interface StreamEventEndQuotaExceeded extends StreamEventEndBase {
  outcome: 'quota_exceeded'
  message?: string
  resetTime?: Date
}

// StreamEventText - Agent's text response
export interface StreamEventText {
  type: 'stream_text'
  text: string
}

// StreamEventThinking - Agent's thinking/reasoning content (summarized in Claude 4)
export interface StreamEventThinking {
  type: 'stream_thinking'
  thinking: string
}

// StreamEventToolInvocation - Agent's tool call request
export interface StreamEventToolInvocation {
  type: 'stream_tool_invocation'
  name: string
  input: Record<string, unknown>
}

// StreamEventToolResponse - Tool execution result (returned to Agent)
export interface StreamEventToolResponse {
  type: 'stream_tool_response'
  toolUseId: string
  content: string
  isError: boolean
}

// StreamEventEnd - discriminated union of all session end variants
export type StreamEventEnd =
  | StreamEventEndCompleted
  | StreamEventEndExecutionError
  | StreamEventEndMaxIterations
  | StreamEventEndBudgetExceeded
  | StreamEventEndQuotaExceeded

// StreamEventError - Error event from stream (SDK errors wrapped as events)
export interface StreamEventError {
  type: 'stream_error'
  message: string
  stack?: string
}

// StreamEvent - discriminated union of all event types
export type StreamEvent =
  | StreamEventText
  | StreamEventThinking
  | StreamEventToolInvocation
  | StreamEventToolResponse
  | StreamEventEnd
  | StreamEventError

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
