import { describe, it, expect } from 'vitest'
import { SessionRunner } from '../src/sessionRunner'
import { silentLogger } from '../src/logger'
import {
  MockAgentClient,
  MockDeliverableStatusReader,
  createMockTextMessage,
  createMockResultMessage,
  createMockStatusJson,
  TestLogger,
} from './helpers'

describe('SessionRunner', () => {
  describe('run()', () => {
    it('returns a SessionRunnerResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(client)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('iterations')
      expect(result).toHaveProperty('deliverablesPassedCount')
      expect(result).toHaveProperty('deliverablesTotalCount')
      expect(result).toHaveProperty('totalDuration')
    })

    it('runs at least one session', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('done', 0.01)])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(client)

      expect(result.iterations).toBeGreaterThanOrEqual(1)
    })

    it('accepts runner options', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])

      // When statusReader is not provided and maxIterations is set,
      // runner will stop at maxIterations with success=false
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
        delayBetweenSessions: 0,
        model: 'claude-3',
      })
      const result = await runner.run(client)

      // Without statusReader, success is false (max iterations reached without deliverables)
      expect(result.iterations).toBe(1)
    })

    it('SC-L004: uses injected logger for session status', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('done', 0.0123)])
      const logger = new TestLogger()

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(client, logger)

      expect(logger.hasMessage('Session 1 started')).toBe(true)
      expect(logger.hasMessage('Session 1:')).toBe(true)
    })

    it('tracks total duration across sessions', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(client)

      expect(result.totalDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('SC-S004: Max iterations reached', () => {
    it('stops after maxIterations sessions', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockResultMessage('session 1', 0.01)],
        [createMockResultMessage('session 2', 0.01)],
        [createMockResultMessage('session 3', 0.01)],
      ])

      // Status reader that never returns all passed
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: false,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 2,
        delayBetweenSessions: 0,
      })
      const result = await runner.run(client, silentLogger, statusReader)

      expect(result.iterations).toBe(2)
      expect(result.success).toBe(false)
      expect(client.getQueryCount()).toBe(2)
    })
  })

  describe('SC-S008: Early exit on all deliverables pass', () => {
    it('exits immediately when all deliverables pass', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('done', 0.01)])

      // Status with all passed deliverables after first session
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: true,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 5,
        delayBetweenSessions: 0,
      })
      const result = await runner.run(client, silentLogger, statusReader)

      expect(result.iterations).toBe(1)
      expect(result.success).toBe(true)
      expect(result.deliverablesPassedCount).toBe(1)
      expect(result.deliverablesTotalCount).toBe(1)
    })
  })

  describe('SC-S009: Continue without maxIterations', () => {
    it('continues until all deliverables pass when no maxIterations', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockResultMessage('session 1', 0.01)],
        [createMockResultMessage('session 2', 0.01)],
        [createMockResultMessage('session 3', 0.01)],
      ])

      // Progress from 0/2 passed -> 1/2 passed -> 2/2 passed
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: false,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: true,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: true,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: true,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        // No maxIterations - run until done
        delayBetweenSessions: 0,
      })
      const result = await runner.run(client, silentLogger, statusReader)

      expect(result.iterations).toBe(3)
      expect(result.success).toBe(true)
      expect(result.deliverablesPassedCount).toBe(2)
      expect(result.deliverablesTotalCount).toBe(2)
    })
  })

  describe('SC-S010: Delay between sessions', () => {
    it('waits delayBetweenSessions before next session', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockResultMessage('session 1', 0.01)],
        [createMockResultMessage('session 2', 0.01)],
      ])

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC'],
            passed: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC'],
            passed: true,
          },
        ]),
      ])

      const delayMs = 100
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: delayMs,
      })

      const startTime = Date.now()
      await runner.run(client, silentLogger, statusReader)
      const elapsed = Date.now() - startTime

      // Should have at least one delay (between session 1 and 2)
      // Give some tolerance for test execution overhead
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10)
    })
  })
})
