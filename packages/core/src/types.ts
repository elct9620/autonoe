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
 * StreamEventEnd - discriminated union by outcome
 * @see SPEC.md Section 2.3 Domain Model
 */
export type StreamEventEnd = {
  type: 'stream_end'
  totalCostUsd?: number
} & (
  | { outcome: 'completed'; result?: string }
  | { outcome: 'execution_error'; messages: string[] }
  | { outcome: 'max_iterations' }
  | { outcome: 'budget_exceeded' }
  | { outcome: 'quota_exceeded'; message?: string; resetTime?: Date }
)

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
