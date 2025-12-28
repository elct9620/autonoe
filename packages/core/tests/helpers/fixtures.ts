import type { SessionOptions, SessionResult } from '../../src/index'
import type { MockMessage } from './mockAgentClient'

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
export function createMockTextMessage(text: string): MockMessage {
  return {
    type: 'text',
    text,
  }
}

/**
 * Create a mock result message with success subtype
 */
export function createMockResultMessage(
  result: string,
  totalCostUsd?: number,
): MockMessage {
  return {
    type: 'result',
    subtype: 'success',
    result,
    total_cost_usd: totalCostUsd,
    duration_ms: 1000,
    num_turns: 1,
  }
}

/**
 * Create a mock result message with error subtype
 */
export function createMockErrorResultMessage(
  errors: string[],
  subtype: string = 'error_during_execution',
): MockMessage {
  return {
    type: 'result',
    subtype,
    errors,
    duration_ms: 1000,
    num_turns: 1,
  }
}
