import type {
  SessionOptions,
  SessionResult,
  AgentMessage,
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
    scenariosPassedCount: 0,
    scenariosTotalCount: 0,
    duration: 0,
    ...overrides,
  }
}

/**
 * Status JSON scenario structure
 */
export interface StatusScenario {
  id: string
  feature: string
  name: string
  passed: boolean
}

/**
 * Create mock status.json content
 */
export function createMockStatusJson(scenarios: StatusScenario[] = []): {
  scenarios: StatusScenario[]
} {
  return {
    scenarios,
  }
}

/**
 * Default mock scenarios for testing
 */
export const mockScenarios: StatusScenario[] = [
  {
    id: 'SC-F001',
    feature: 'authentication.feature',
    name: 'Successful login',
    passed: false,
  },
  {
    id: 'SC-F002',
    feature: 'authentication.feature',
    name: 'Failed login with wrong password',
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
