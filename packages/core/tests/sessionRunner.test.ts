import { describe, it, expect } from 'vitest'
import { SessionRunner } from '../src/sessionRunner'
import {
  MockAgentClient,
  createMockTextMessage,
  createMockResultMessage,
  TestLogger,
} from './helpers'

describe('SessionRunner', () => {
  describe('run()', () => {
    it('returns a SessionRunnerResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])

      const runner = new SessionRunner({ projectDir: '/test/project' })
      const result = await runner.run(client)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('iterations')
      expect(result).toHaveProperty('scenariosPassedCount')
      expect(result).toHaveProperty('scenariosTotalCount')
      expect(result).toHaveProperty('totalDuration')
    })

    it('runs at least one session', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('done', 0.01)])

      const runner = new SessionRunner({ projectDir: '/test/project' })
      const result = await runner.run(client)

      expect(result.iterations).toBeGreaterThanOrEqual(1)
    })

    it('accepts runner options', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 5,
        delayBetweenSessions: 1000,
        model: 'claude-3',
      })
      const result = await runner.run(client)

      expect(result.success).toBe(true)
    })

    it('SC-L004: uses injected logger for session status', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('done', 0.0123)])
      const logger = new TestLogger()

      const runner = new SessionRunner({ projectDir: '/test/project' })
      await runner.run(client, logger)

      expect(logger.hasMessage('Session 1 started')).toBe(true)
      expect(logger.hasMessage('Session 1:')).toBe(true)
    })

    it('tracks total duration across sessions', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])

      const runner = new SessionRunner({ projectDir: '/test/project' })
      const result = await runner.run(client)

      expect(result.totalDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('SC-S004: Max iterations reached', () => {
    it.skip('stops after maxIterations sessions', async () => {
      // TODO: Implement when loop logic is complete
      // - Create runner with maxIterations: 2
      // - Mock responses for multiple sessions
      // - Verify runner stops after 2 iterations
    })
  })

  describe('SC-S008: Early exit on all scenarios pass', () => {
    it.skip('exits immediately when all scenarios pass', async () => {
      // TODO: Implement when status.json reading is complete
      // - Create mock status with all passed scenarios
      // - Verify runner exits with success on first iteration
    })
  })

  describe('SC-S009: Continue without maxIterations', () => {
    it.skip('continues until all scenarios pass when no maxIterations', async () => {
      // TODO: Implement when loop logic is complete
      // - Create runner without maxIterations
      // - Mock partial progress responses
      // - Verify runner continues until all pass
    })
  })

  describe('SC-S010: Delay between sessions', () => {
    it.skip('waits delayBetweenSessions before next session', async () => {
      // TODO: Implement when loop logic is complete
      // - Create runner with delayBetweenSessions: 100
      // - Verify delay occurs between sessions
    })
  })
})
