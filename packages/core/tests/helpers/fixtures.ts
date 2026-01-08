import {
  Deliverable,
  DeliverableStatus,
  type StreamEventText,
  type StreamEventToolInvocation,
  type StreamEventToolResponse,
  type StreamEventEnd,
  type StreamEventError,
} from '../../src/index'

/**
 * Create mock status.json content
 */
export function createMockStatusJson(
  deliverables: Deliverable[] = [],
  createdAt = '2025-01-01',
  updatedAt = '2025-01-01',
): DeliverableStatus {
  return DeliverableStatus.create(createdAt, updatedAt, deliverables)
}

/**
 * Default mock deliverables for testing
 */
export const mockDeliverables: Deliverable[] = [
  Deliverable.pending('DL-001', 'User Authentication', [
    'User can login with email and password',
    'Invalid credentials show error message',
  ]),
  Deliverable.pending('DL-002', 'Dashboard', [
    'Dashboard loads within 2 seconds',
    'All widgets display correctly',
  ]),
]

/**
 * Create a pending deliverable for testing
 */
export function createPendingDeliverable(
  id: string,
  description: string,
  acceptanceCriteria: string[] = ['AC'],
): Deliverable {
  return Deliverable.pending(id, description, acceptanceCriteria)
}

/**
 * Create a passed deliverable for testing
 */
export function createPassedDeliverable(
  id: string,
  description: string,
  acceptanceCriteria: string[] = ['AC'],
): Deliverable {
  return Deliverable.passed(id, description, acceptanceCriteria)
}

/**
 * Create a blocked deliverable for testing
 */
export function createBlockedDeliverable(
  id: string,
  description: string,
  acceptanceCriteria: string[] = ['AC'],
): Deliverable {
  return Deliverable.blocked(id, description, acceptanceCriteria)
}

// Re-export Deliverable for convenience in tests
export { Deliverable }

/**
 * Create a mock StreamEventText event for testing
 */
export function createMockStreamText(text: string): StreamEventText {
  return {
    type: 'stream_text',
    text,
  }
}

/**
 * Create a mock StreamEventToolInvocation event for testing
 */
export function createMockToolInvocation(
  name: string,
  input: Record<string, unknown> = {},
): StreamEventToolInvocation {
  return {
    type: 'stream_tool_invocation',
    name,
    input,
  }
}

/**
 * Create a mock StreamEventToolResponse event for testing
 */
export function createMockToolResponse(
  content: string,
  isError = false,
  toolUseId = 'test-id',
): StreamEventToolResponse {
  return {
    type: 'stream_tool_response',
    toolUseId,
    content,
    isError,
  }
}

/**
 * Create a mock StreamEventEnd event with completed outcome
 */
export function createMockStreamEnd(
  result?: string,
  totalCostUsd?: number,
): StreamEventEnd {
  return {
    type: 'stream_end',
    outcome: 'completed',
    result,
    totalCostUsd,
  }
}

/**
 * Create a mock StreamEventEnd event with error outcome
 */
export function createMockErrorStreamEnd(messages: string[]): StreamEventEnd {
  return {
    type: 'stream_end',
    outcome: 'execution_error',
    messages,
  }
}

/**
 * Create a mock StreamEventEnd event with quota exceeded outcome
 */
export function createMockQuotaExceededStreamEnd(
  message: string,
  resetTime?: Date,
): StreamEventEnd {
  return {
    type: 'stream_end',
    outcome: 'quota_exceeded',
    message,
    resetTime,
  }
}

/**
 * Create a mock StreamEventError event for testing
 */
export function createMockStreamError(
  message: string,
  stack?: string,
): StreamEventError {
  return {
    type: 'stream_error',
    message,
    stack,
  }
}
