import type {
  SessionOptions,
  SessionResult,
  StreamEvent,
  AgentText,
  ToolInvocation,
  ToolResponse,
  SessionEnd,
  Deliverable,
  DeliverableStatus,
} from '../../src/index'
import { ResultSubtype } from '../../src/index'

/**
 * Create a minimal valid SessionOptions for testing
 */
export function createSessionOptions(
  overrides: Partial<SessionOptions> = {},
): SessionOptions {
  return {
    projectDir: '/test/project',
    ...overrides,
  }
}

/**
 * Create a minimal valid SessionResult for testing
 */
export function createSessionResult(
  overrides: Partial<SessionResult> = {},
): SessionResult {
  return {
    success: true,
    costUsd: 0,
    duration: 0,
    deliverablesPassedCount: 0,
    deliverablesTotalCount: 0,
    ...overrides,
  }
}

/**
 * Create mock status.json content
 */
export function createMockStatusJson(
  deliverables: Deliverable[] = [],
): DeliverableStatus {
  return {
    deliverables,
  }
}

/**
 * Default mock deliverables for testing
 */
export const mockDeliverables: Deliverable[] = [
  {
    id: 'DL-001',
    name: 'User Authentication',
    acceptanceCriteria: [
      'User can login with email and password',
      'Invalid credentials show error message',
    ],
    passed: false,
    blocked: false,
  },
  {
    id: 'DL-002',
    name: 'Dashboard',
    acceptanceCriteria: [
      'Dashboard loads within 2 seconds',
      'All widgets display correctly',
    ],
    passed: false,
    blocked: false,
  },
]

/**
 * Create a mock AgentText event for testing
 */
export function createMockAgentText(text: string): AgentText {
  return {
    type: 'agent_text',
    text,
  }
}

/**
 * Create a mock ToolInvocation event for testing
 */
export function createMockToolInvocation(
  name: string,
  input: Record<string, unknown> = {},
): ToolInvocation {
  return {
    type: 'tool_invocation',
    name,
    input,
  }
}

/**
 * Create a mock ToolResponse event for testing
 */
export function createMockToolResponse(
  content: string,
  isError = false,
  toolUseId = 'test-id',
): ToolResponse {
  return {
    type: 'tool_response',
    toolUseId,
    content,
    isError,
  }
}

/**
 * Create a mock SessionEnd event with success subtype
 */
export function createMockSessionEnd(
  result: string,
  totalCostUsd?: number,
): SessionEnd {
  return {
    type: 'session_end',
    subtype: ResultSubtype.Success,
    result,
    totalCostUsd,
  }
}

/**
 * Create a mock SessionEnd event with error subtype
 */
export function createMockErrorSessionEnd(
  errors: string[],
  subtype: ResultSubtype = ResultSubtype.ErrorDuringExecution,
): SessionEnd {
  return {
    type: 'session_end',
    subtype,
    errors,
  }
}

/**
 * Helper to cast StreamEvent types for tests
 */
export function asStreamEvent(event: StreamEvent): StreamEvent {
  return event
}
