import type {
  SessionOptions,
  SessionResult,
  AgentMessage,
  Deliverable,
  DeliverableStatus,
} from '../../src/index'
import { AgentMessageType, ResultSubtype } from '../../src/index'

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
  },
  {
    id: 'DL-002',
    name: 'Dashboard',
    acceptanceCriteria: [
      'Dashboard loads within 2 seconds',
      'All widgets display correctly',
    ],
    passed: false,
  },
]

/**
 * Create a mock text message for testing AgentClient
 */
export function createMockTextMessage(text: string): AgentMessage {
  return {
    type: AgentMessageType.Text,
    text,
  } as AgentMessage
}

/**
 * Create a mock result message with success subtype
 */
export function createMockResultMessage(
  result: string,
  totalCostUsd?: number,
): AgentMessage {
  return {
    type: AgentMessageType.Result,
    subtype: ResultSubtype.Success,
    result,
    totalCostUsd,
  } as AgentMessage
}

/**
 * Create a mock result message with error subtype
 */
export function createMockErrorResultMessage(
  errors: string[],
  subtype: ResultSubtype = ResultSubtype.ErrorDuringExecution,
): AgentMessage {
  return {
    type: AgentMessageType.Result,
    subtype,
    errors,
  } as AgentMessage
}
