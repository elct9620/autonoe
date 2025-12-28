import { describe, it, expect } from 'vitest'
import { Session } from '../src/session'
import { MockAgentClient } from './mockAgentClient'
import { createMockTextMessage } from './fixtures'
import { TestLogger } from './testLogger'

describe('Session', () => {
  describe('run()', () => {
    it('returns a SessionResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('2')])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('scenariosPassedCount')
      expect(result).toHaveProperty('scenariosTotalCount')
      expect(result).toHaveProperty('duration')
    })

    it('queries the agent with test message', async () => {
      const client = new MockAgentClient()
      client.setResponses([])

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client)

      expect(client.getLastMessage()).toBe('Hello, what is 1 + 1?')
    })

    it('accepts session options', async () => {
      const client = new MockAgentClient()
      client.setResponses([])

      const session = new Session({
        projectDir: '/test/project',
        maxIterations: 10,
      })
      const result = await session.run(client)

      expect(result.success).toBe(true)
    })

    it('SC-L004: uses injected logger for debug messages', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('2')])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, logger)

      expect(logger.hasMessage('Sending:')).toBe(true)
      expect(logger.hasMessage('Received:')).toBe(true)

      const debugEntries = logger.getEntriesByLevel('debug')
      expect(debugEntries.length).toBeGreaterThan(0)
    })
  })

  describe('SC-S001: Session with SPEC.md', () => {
    it.skip('starts session successfully when SPEC.md exists', async () => {
      // TODO: Implement when Session reads SPEC.md
      // - Create temp directory with SPEC.md
      // - Create Session with MockAgentClient
      // - Verify session starts without error
    })
  })

  describe('SC-S002: No status.json', () => {
    it.skip('uses initializerPrompt when no .autonoe/status.json exists', async () => {
      // TODO: Implement when prompts system is created
      // - Create temp directory without .autonoe/
      // - Verify initializerPrompt is selected
    })
  })

  describe('SC-S003: All scenarios passed', () => {
    it.skip('completes with success when all scenarios pass', async () => {
      // TODO: Implement when Session orchestration is complete
      // - Create MockAgentClient with all-pass responses
      // - Verify result.success === true
      // - Verify scenariosPassedCount === scenariosTotalCount
    })
  })

  describe('SC-S004: Max iterations reached', () => {
    it.skip('stops session when max iterations reached', async () => {
      // TODO: Implement when Session handles iteration limits
      // - Create session with maxIterations: 2
      // - Verify session stops after 2 iterations
      // - Verify partial progress is reported
    })
  })

  describe('SC-S005: Agent interruption', () => {
    it.skip('stops cleanly when agent is interrupted', async () => {
      // TODO: Implement when Query.interrupt() is available
      // - Start session
      // - Call interrupt mid-execution
      // - Verify clean shutdown
    })
  })
})
