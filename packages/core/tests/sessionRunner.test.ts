import { describe, it, expect } from 'vitest'
import { SessionRunner } from '../src/sessionRunner'
import { silentLogger } from '../src/logger'
import {
  MockAgentClient,
  MockDeliverableStatusReader,
  createMockAgentText,
  createMockSessionEnd,
  createMockStatusJson,
  createMockClientFactory,
  TestLogger,
} from './helpers'

describe('SessionRunner', () => {
  describe('run()', () => {
    it('returns a SessionRunnerResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockAgentText('done')])
      const factory = createMockClientFactory(client)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(factory)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('iterations')
      expect(result).toHaveProperty('deliverablesPassedCount')
      expect(result).toHaveProperty('deliverablesTotalCount')
      expect(result).toHaveProperty('totalDuration')
    })

    it('runs at least one session', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockSessionEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(factory)

      expect(result.iterations).toBeGreaterThanOrEqual(1)
    })

    it('accepts runner options', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockAgentText('done')])
      const factory = createMockClientFactory(client)

      // When statusReader is not provided and maxIterations is set,
      // runner will stop at maxIterations with success=false
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
        delayBetweenSessions: 0,
        model: 'claude-3',
      })
      const result = await runner.run(factory)

      // Without statusReader, success is false (max iterations reached without deliverables)
      expect(result.iterations).toBe(1)
    })

    it('SC-L004: uses injected logger for session status', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockSessionEnd('done', 0.0123)])
      const factory = createMockClientFactory(client)
      const logger = new TestLogger()

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(factory, logger)

      expect(logger.hasMessage('Session 1 started')).toBe(true)
      expect(logger.hasMessage('Session 1:')).toBe(true)
    })

    it('tracks total duration across sessions', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockAgentText('done')])
      const factory = createMockClientFactory(client)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(factory)

      expect(result.totalDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('SC-S004: Max iterations reached', () => {
    it('stops after maxIterations sessions', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockSessionEnd('session 1', 0.01)],
        [createMockSessionEnd('session 2', 0.01)],
        [createMockSessionEnd('session 3', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      // Status reader that never returns all passed
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: false,
            blocked: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: false,
            blocked: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: false,
            blocked: false,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 2,
        delayBetweenSessions: 0,
      })
      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.iterations).toBe(2)
      expect(result.success).toBe(false)
      expect(client.getQueryCount()).toBe(2)
    })
  })

  describe('SC-S008: Early exit on all deliverables pass', () => {
    it('exits immediately when all deliverables pass', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockSessionEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      // Status with all passed deliverables after first session
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC1'],
            passed: true,
            blocked: false,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 5,
        delayBetweenSessions: 0,
      })
      const result = await runner.run(factory, silentLogger, statusReader)

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
        [createMockSessionEnd('session 1', 0.01)],
        [createMockSessionEnd('session 2', 0.01)],
        [createMockSessionEnd('session 3', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      // Progress from 0/2 passed -> 1/2 passed -> 2/2 passed
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: false,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: false,
            blocked: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: true,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: false,
            blocked: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: true,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: true,
            blocked: false,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        // No maxIterations - run until done
        delayBetweenSessions: 0,
      })
      const result = await runner.run(factory, silentLogger, statusReader)

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
        [createMockSessionEnd('session 1', 0.01)],
        [createMockSessionEnd('session 2', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC'],
            passed: true,
            blocked: false,
          },
        ]),
      ])

      const delayMs = 100
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: delayMs,
      })

      const startTime = Date.now()
      await runner.run(factory, silentLogger, statusReader)
      const elapsed = Date.now() - startTime

      // Should have at least one delay (between session 1 and 2)
      // Give some tolerance for test execution overhead
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10)
    })
  })

  describe('SC-S020: All achievable passed (some blocked)', () => {
    it('exits with success when all non-blocked deliverables pass', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([[createMockSessionEnd('done', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Passed',
            acceptanceCriteria: ['AC'],
            passed: true,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Blocked',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: true,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.success).toBe(true)
      expect(result.blockedCount).toBe(1)
      expect(result.deliverablesPassedCount).toBe(1)
    })
  })

  describe('SC-S021: All deliverables blocked', () => {
    it('exits with failure when all deliverables are blocked', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([[createMockSessionEnd('blocked', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Blocked',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: true,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.success).toBe(false)
      expect(result.blockedCount).toBe(1)
    })
  })

  describe('SC-S023: blockedCount in result', () => {
    it('includes correct blockedCount in result', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([[createMockSessionEnd('done', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Passed',
            acceptanceCriteria: ['AC'],
            passed: true,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Blocked1',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: true,
          },
          {
            id: 'DL-003',
            name: 'Blocked2',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: true,
          },
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.blockedCount).toBe(2)
      expect(result.deliverablesTotalCount).toBe(3)
    })
  })

  describe('SC-S011: Overall output with cost and duration', () => {
    it('logs Overall with accumulated cost after all passed', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockSessionEnd('session 1', 0.0123)],
        [createMockSessionEnd('session 2', 0.0234)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: false,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: false,
            blocked: false,
          },
          {
            id: 'DL-003',
            name: 'Test3',
            acceptanceCriteria: ['AC3'],
            passed: false,
            blocked: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test1',
            acceptanceCriteria: ['AC1'],
            passed: true,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Test2',
            acceptanceCriteria: ['AC2'],
            passed: true,
            blocked: false,
          },
          {
            id: 'DL-003',
            name: 'Test3',
            acceptanceCriteria: ['AC3'],
            passed: true,
            blocked: false,
          },
        ]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, logger, statusReader)

      expect(result.totalCostUsd).toBeCloseTo(0.0357, 4)
      expect(result.iterations).toBe(2)
      expect(logger.hasMessage('Overall:')).toBe(true)
      expect(logger.hasMessage('2 session(s)')).toBe(true)
      expect(logger.hasMessage('3/3 deliverables passed')).toBe(true)
      expect(logger.hasMessage('cost=$')).toBe(true)
      expect(logger.hasMessage('duration=')).toBe(true)
    })
  })

  describe('SC-S012: Overall output with blocked', () => {
    it('logs Overall with blocked count', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([[createMockSessionEnd('done', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Passed',
            acceptanceCriteria: ['AC'],
            passed: true,
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Blocked1',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: true,
          },
          {
            id: 'DL-003',
            name: 'Blocked2',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: true,
          },
        ]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      await runner.run(factory, logger, statusReader)

      expect(logger.hasMessage('Overall:')).toBe(true)
      expect(logger.hasMessage('(2 blocked)')).toBe(true)
    })
  })

  describe('SC-S013: Overall logged before max iterations exit', () => {
    it('logs Overall when max iterations reached', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockSessionEnd('session 1', 0.01)],
        [createMockSessionEnd('session 2', 0.02)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: false,
          },
        ]),
        createMockStatusJson([
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['AC'],
            passed: false,
            blocked: false,
          },
        ]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 2,
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, logger, statusReader)

      expect(result.success).toBe(false)
      expect(result.totalCostUsd).toBeCloseTo(0.03, 4)
      expect(logger.hasMessage('Overall:')).toBe(true)
    })
  })

  describe('totalCostUsd in result', () => {
    it('returns totalCostUsd in SessionRunnerResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockSessionEnd('done', 0.0123)])
      const factory = createMockClientFactory(client)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(factory)

      expect(result).toHaveProperty('totalCostUsd')
      expect(result.totalCostUsd).toBeCloseTo(0.0123, 4)
    })
  })
})
