/**
 * Domain types for Autonoe
 * @see SPEC.md Section 2.3 Domain Model
 */

// AgentMessageType - enum for message types
export enum AgentMessageType {
  Text = 'text',
  Result = 'result',
}

// AgentMessage - base message type
export interface AgentMessage {
  type: AgentMessageType
}

// ResultSubtype - enum for result outcomes
export enum ResultSubtype {
  Success = 'success',
  ErrorMaxTurns = 'error_max_turns',
  ErrorDuringExecution = 'error_during_execution',
  ErrorMaxBudgetUsd = 'error_max_budget_usd',
}

// ResultMessage - execution result (extends AgentMessage)
export interface ResultMessage extends AgentMessage {
  type: AgentMessageType.Result
  subtype: ResultSubtype
  result?: string
  errors?: string[]
  totalCostUsd?: number
}

// MessageStream - async generator with interrupt
export interface MessageStream extends AsyncGenerator<AgentMessage, void> {
  interrupt(): Promise<void>
}

// McpServer - external tool server configuration
export interface McpServer {
  command: string
  args?: string[]
}

// PermissionLevel - security permission level
export type PermissionLevel = 'default' | 'acceptEdits' | 'bypassPermissions'
