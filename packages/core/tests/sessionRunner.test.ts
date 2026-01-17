import { describe, it, expect, vi } from 'vitest'
import { SessionRunner } from '../src/sessionRunner'
import { silentLogger } from '../src/logger'
import type { AgentClient, AgentClientFactory } from '../src/agentClient'
import type { MessageStream } from '../src/types'
import { VerificationTracker } from '../src/verificationTracker'
import {
  MockAgentClient,
  MockDeliverableStatusReader,
  createMockStreamText,
  createMockStreamEnd,
  createMockErrorStreamEnd,
  createMockQuotaExceededStreamEnd,
  createMockStreamError,
  createMockStatusJson,
  createMockClientFactory,
  TestLogger,
  Deliverable,
} from './helpers'

/**
 * Mock client that throws errors for retry testing
 */
class ThrowingMockClient implements AgentClient {
  private throwCount: number
  private callCount = 0
  private successResponses: ReturnType<typeof createMockStreamEnd>[]

  constructor(
    throwCount: number,
    successResponses: ReturnType<typeof createMockStreamEnd>[],
  ) {
    this.throwCount = throwCount
    this.successResponses = successResponses
  }

  getCallCount(): number {
    return this.callCount
  }

  async dispose(): Promise<void> {}

  query(): MessageStream {
    this.callCount++
    if (this.callCount <= this.throwCount) {
      throw new Error(`Session error ${this.callCount}`)
    }

    const responses = this.successResponses
    const generator = (async function* () {
      for (const response of responses) {
        yield response
      }
    })()

    const stream = generator as MessageStream
    stream.interrupt = async () => {}
    return stream
  }
}

describe('SessionRunner', () => {
  describe('SC-S001: Project with SPEC.md', () => {
    it('starts session successfully with valid project', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(factory)

      expect(result.iterations).toBeGreaterThanOrEqual(1)
      expect(result).toHaveProperty('totalDuration')
      expect(result).toHaveProperty('totalCostUsd')
    })
  })

  describe('SC-S002: No status.json uses initializerInstruction', () => {
    it('uses initializer instruction when status.json does not exist', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])

      // Track which instruction name was passed to create()
      let receivedInstructionName: string | undefined
      const factory: AgentClientFactory = {
        create: (instructionName) => {
          receivedInstructionName = instructionName
          return client
        },
      }

      // Empty status sequence = no status.json
      const statusReader = new MockDeliverableStatusReader()
      // Don't set any status sequence - exists() will return false

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(factory, silentLogger, statusReader)

      // Should use 'initializer' instruction when no status.json
      expect(receivedInstructionName).toBe('initializer')
    })

    it('uses coding instruction when status.json exists', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])

      let receivedInstructionName: string | undefined
      const factory: AgentClientFactory = {
        create: (instructionName) => {
          receivedInstructionName = instructionName
          return client
        },
      }

      // Status with deliverables = status.json exists
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(factory, silentLogger, statusReader)

      // Should use 'coding' instruction when status.json exists
      expect(receivedInstructionName).toBe('coding')
    })
  })

  describe('SC-S006: Result event success logging', () => {
    it('logs result text on successful session end', async () => {
      const client = new MockAgentClient()
      client.setResponses([
        createMockStreamEnd('Task completed successfully', 0.01),
      ])
      const factory = createMockClientFactory(client)
      const logger = new TestLogger()

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(factory, logger)

      // Should log the result text from stream_end event
      expect(logger.hasMessage('Task completed successfully')).toBe(true)
    })

    it('does not log when result is undefined', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd(undefined, 0.01)])
      const factory = createMockClientFactory(client)
      const logger = new TestLogger()

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(factory, logger)

      // Should not log any result text (only session info)
      const entries = logger.getEntries()
      const infoLogs = entries.filter((e) => e.level === 'info')
      // Only 'Session 1 started', 'Session 1: cost=...', and 'Overall:' should be logged
      expect(infoLogs.every((e) => !e.message.includes('undefined'))).toBe(true)
    })
  })

  describe('SC-S007: Result event error logging', () => {
    it('logs error messages on execution_error outcome', async () => {
      const client = new MockAgentClient()
      client.setResponses([
        createMockErrorStreamEnd([
          'Error 1: Something went wrong',
          'Error 2: Failed to process',
        ]),
      ])
      const factory = createMockClientFactory(client)
      const logger = new TestLogger()

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(factory, logger)

      // Should log each error message via logger.error()
      const errorLogs = logger.getEntries().filter((e) => e.level === 'error')
      expect(
        errorLogs.some((e) =>
          e.message.includes('Error 1: Something went wrong'),
        ),
      ).toBe(true)
      expect(
        errorLogs.some((e) => e.message.includes('Error 2: Failed to process')),
      ).toBe(true)
    })

    it('logs all error messages when multiple present', async () => {
      const client = new MockAgentClient()
      const errorMessages = ['First error', 'Second error', 'Third error']
      client.setResponses([createMockErrorStreamEnd(errorMessages)])
      const factory = createMockClientFactory(client)
      const logger = new TestLogger()

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      await runner.run(factory, logger)

      // All error messages should be logged
      const errorLogs = logger.getEntries().filter((e) => e.level === 'error')
      for (const msg of errorMessages) {
        expect(errorLogs.some((e) => e.message.includes(msg))).toBe(true)
      }
    })
  })

  describe('SC-S003: All deliverables passed', () => {
    it('completes session with success when all deliverables pass', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.passed('DL-001', 'Test 1', ['AC1']),
          Deliverable.passed('DL-002', 'Test 2', ['AC2']),
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })
      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.exitReason).toBe('all_passed')
      expect(result.deliverablesPassedCount).toBe(2)
      expect(result.deliverablesTotalCount).toBe(2)
    })
  })

  describe('SC-S005: Agent interruption', () => {
    it('stops cleanly when interrupted during session', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const controller = new AbortController()
      // Interrupt after a short delay
      setTimeout(() => controller.abort(), 10)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 100, // Long delay to allow interrupt
      })

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
      ])

      const result = await runner.run(
        factory,
        silentLogger,
        statusReader,
        undefined,
        controller.signal,
      )

      expect(result.exitReason).toBe('interrupted')
    })
  })

  describe('run()', () => {
    it('returns a SessionRunnerResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamText('done')])
      const factory = createMockClientFactory(client)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
      })
      const result = await runner.run(factory)

      expect(result).toHaveProperty('iterations')
      expect(result).toHaveProperty('deliverablesPassedCount')
      expect(result).toHaveProperty('deliverablesTotalCount')
      expect(result).toHaveProperty('totalDuration')
    })

    it('runs at least one session', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
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
      client.setResponses([createMockStreamText('done')])
      const factory = createMockClientFactory(client)

      // When statusReader is not provided and maxIterations is set,
      // runner will stop at maxIterations
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
        delayBetweenSessions: 0,
        model: 'claude-3',
      })
      const result = await runner.run(factory)

      // Without statusReader, max iterations reached without deliverables
      expect(result.iterations).toBe(1)
    })

    it('SC-L004: uses injected logger for session status', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.0123)])
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
      client.setResponses([createMockStreamText('done')])
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
        [createMockStreamEnd('session 1', 0.01)],
        [createMockStreamEnd('session 2', 0.01)],
        [createMockStreamEnd('session 3', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      // Status reader that never returns all passed
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC1'])]),
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC1'])]),
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC1'])]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 2,
        delayBetweenSessions: 0,
      })
      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.iterations).toBe(2)
      // Max iterations reached with pending deliverables
      expect(result.deliverablesPassedCount).toBe(0)
      expect(client.getQueryCount()).toBe(2)
    })
  })

  describe('SC-S008: Early exit on all deliverables pass', () => {
    it('exits immediately when all deliverables pass', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      // Status with all passed deliverables after first session
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC1'])]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 5,
        delayBetweenSessions: 0,
      })
      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.iterations).toBe(1)
      // All deliverables passed
      expect(result.deliverablesPassedCount).toBe(1)
      expect(result.deliverablesTotalCount).toBe(1)
    })
  })

  describe('SC-S009: Continue without maxIterations', () => {
    it('continues until all deliverables pass when no maxIterations', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockStreamEnd('session 1', 0.01)],
        [createMockStreamEnd('session 2', 0.01)],
        [createMockStreamEnd('session 3', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      // Progress from 0/2 passed -> 1/2 passed -> 2/2 passed
      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.pending('DL-001', 'Test1', ['AC1']),
          Deliverable.pending('DL-002', 'Test2', ['AC2']),
        ]),
        createMockStatusJson([
          Deliverable.passed('DL-001', 'Test1', ['AC1']),
          Deliverable.pending('DL-002', 'Test2', ['AC2']),
        ]),
        createMockStatusJson([
          Deliverable.passed('DL-001', 'Test1', ['AC1']),
          Deliverable.passed('DL-002', 'Test2', ['AC2']),
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        // No maxIterations - run until done
        delayBetweenSessions: 0,
      })
      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.iterations).toBe(3)
      // All deliverables passed
      expect(result.deliverablesPassedCount).toBe(2)
      expect(result.deliverablesTotalCount).toBe(2)
    })
  })

  describe('SC-S010: Delay between sessions', () => {
    it('waits delayBetweenSessions before next session', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([
        [createMockStreamEnd('session 1', 0.01)],
        [createMockStreamEnd('session 2', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
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
      client.setResponsesPerSession([[createMockStreamEnd('done', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.passed('DL-001', 'Passed', ['AC']),
          Deliverable.blocked('DL-002', 'Blocked', ['AC']),
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, silentLogger, statusReader)

      // All achievable deliverables passed (1 passed + 1 blocked = 2 total)
      expect(result.deliverablesPassedCount).toBe(1)
      expect(result.blockedCount).toBe(1)
    })
  })

  describe('SC-S021: All deliverables blocked', () => {
    it('exits with failure when all deliverables are blocked', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([[createMockStreamEnd('blocked', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.blocked('DL-001', 'Blocked', ['AC']),
        ]),
      ])

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, silentLogger, statusReader)

      // All deliverables blocked - no achievable work
      expect(result.blockedCount).toBe(1)
      expect(result.deliverablesPassedCount).toBe(0)
    })
  })

  describe('SC-S023: blockedCount in result', () => {
    it('includes correct blockedCount in result', async () => {
      const client = new MockAgentClient()
      client.setResponsesPerSession([[createMockStreamEnd('done', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.passed('DL-001', 'Passed', ['AC']),
          Deliverable.blocked('DL-002', 'Blocked1', ['AC']),
          Deliverable.blocked('DL-003', 'Blocked2', ['AC']),
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
        [createMockStreamEnd('session 1', 0.0123)],
        [createMockStreamEnd('session 2', 0.0234)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.pending('DL-001', 'Test1', ['AC1']),
          Deliverable.pending('DL-002', 'Test2', ['AC2']),
          Deliverable.pending('DL-003', 'Test3', ['AC3']),
        ]),
        createMockStatusJson([
          Deliverable.passed('DL-001', 'Test1', ['AC1']),
          Deliverable.passed('DL-002', 'Test2', ['AC2']),
          Deliverable.passed('DL-003', 'Test3', ['AC3']),
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
      client.setResponsesPerSession([[createMockStreamEnd('done', 0.01)]])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.passed('DL-001', 'Passed', ['AC']),
          Deliverable.blocked('DL-002', 'Blocked1', ['AC']),
          Deliverable.blocked('DL-003', 'Blocked2', ['AC']),
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
        [createMockStreamEnd('session 1', 0.01)],
        [createMockStreamEnd('session 2', 0.02)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 2,
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, logger, statusReader)

      // Max iterations reached with pending deliverables
      expect(result.deliverablesPassedCount).toBe(0)
      expect(result.totalCostUsd).toBeCloseTo(0.03, 4)
      expect(logger.hasMessage('Overall:')).toBe(true)
    })
  })

  describe('totalCostUsd in result', () => {
    it('returns totalCostUsd in SessionRunnerResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.0123)])
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

  describe('SC-S017: Session returns failure result (stream_error)', () => {
    it('triggers retry when session returns failure via stream_error', async () => {
      const client = new MockAgentClient()
      // First session: stream_error without stream_end -> Session returns { success: false }
      // Second session: normal success
      client.setResponsesPerSession([
        [createMockStreamError('Connection lost')],
        [createMockStreamEnd('done', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxRetries: 3,
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, logger, statusReader)

      // Should have retried after stream_error and succeeded
      expect(result.exitReason).toBe('all_passed')
      expect(result.deliverablesPassedCount).toBe(1)
      expect(logger.hasMessage('Session error (1/3)')).toBe(true)
    })

    it('returns max_retries_exceeded when stream_error persists', async () => {
      const client = new MockAgentClient()
      // All sessions return stream_error
      client.setResponsesPerSession([
        [createMockStreamError('Error 1')],
        [createMockStreamError('Error 2')],
        [createMockStreamError('Error 3')],
        [createMockStreamError('Error 4')],
      ])
      const factory = createMockClientFactory(client)

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxRetries: 3,
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, logger)

      expect(result.exitReason).toBe('max_retries_exceeded')
      if (result.exitReason === 'max_retries_exceeded') {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('Retry on session error', () => {
    describe('SC-S014: Session error, retry succeeds', () => {
      it('should retry on session error and create new session', async () => {
        const throwingClient = new ThrowingMockClient(2, [
          createMockStreamEnd('success', 0.01),
        ])

        const statusReader = new MockDeliverableStatusReader()
        statusReader.setStatusSequence([
          createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
        ])

        const factory: AgentClientFactory = {
          create: () => throwingClient,
        }

        const logger = new TestLogger()
        const runner = new SessionRunner({
          projectDir: '/test/project',
          maxRetries: 3,
          delayBetweenSessions: 0,
        })

        const result = await runner.run(factory, logger, statusReader)

        // Should have called query 3 times (2 errors + 1 success)
        expect(throwingClient.getCallCount()).toBe(3)
        // All deliverables passed after retry
        expect(result.deliverablesPassedCount).toBe(1)
        expect(logger.hasMessage('Session error (1/3)')).toBe(true)
        expect(logger.hasMessage('Session error (2/3)')).toBe(true)
      })
    })

    describe('SC-S015: Session error, maxRetries exceeded', () => {
      it('should return result with error after maxRetries consecutive errors', async () => {
        const throwingClient = new ThrowingMockClient(5, [
          createMockStreamEnd('never reached', 0.01),
        ])

        const factory: AgentClientFactory = {
          create: () => throwingClient,
        }

        const logger = new TestLogger()
        const runner = new SessionRunner({
          projectDir: '/test/project',
          maxRetries: 3,
          delayBetweenSessions: 0,
        })

        const result = await runner.run(factory, logger)

        // Should have called query 4 times (3 retries + 1 initial)
        expect(throwingClient.getCallCount()).toBe(4)
        // Max retries exceeded - error present
        expect(result.exitReason).toBe('max_retries_exceeded')
        if (result.exitReason === 'max_retries_exceeded') {
          expect(result.error).toBe('Session error 4')
        }
        expect(
          logger.hasMessage('Session failed after 3 consecutive errors'),
        ).toBe(true)
      })
    })

    it('should log overall info when max retries exceeded', async () => {
      const throwingClient = new ThrowingMockClient(5, [])

      const factory: AgentClientFactory = {
        create: () => throwingClient,
      }

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxRetries: 2,
        delayBetweenSessions: 0,
      })

      await runner.run(factory, logger)

      expect(logger.hasMessage('Overall:')).toBe(true)
    })

    describe('SC-S016: Session success after error', () => {
      it('should reset error counter after successful session', async () => {
        // First session errors once, second session succeeds
        let callCount = 0
        const factory: AgentClientFactory = {
          create: () => {
            callCount++
            if (callCount === 1 || callCount === 3) {
              return new ThrowingMockClient(1, [
                createMockStreamEnd('retry success', 0.01),
              ])
            }
            return new ThrowingMockClient(0, [
              createMockStreamEnd('direct success', 0.01),
            ])
          },
        }

        const statusReader = new MockDeliverableStatusReader()
        statusReader.setStatusSequence([
          createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
          createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
          createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
        ])

        const logger = new TestLogger()
        const runner = new SessionRunner({
          projectDir: '/test/project',
          maxRetries: 3,
          delayBetweenSessions: 0,
        })

        const result = await runner.run(factory, logger, statusReader)

        // All deliverables passed after error recovery
        expect(result.deliverablesPassedCount).toBe(1)
        // Error counter should be reset between successful sessions
        // so we should see (1/3) for each retry, not (2/3)
        const entries = logger.getEntries()
        const errorLogs = entries.filter((e) =>
          e.message.includes('Session error'),
        )
        expect(errorLogs.every((e) => e.message.includes('(1/3)'))).toBe(true)
      })
    })

    it('should use default maxRetries=3 when not specified', async () => {
      const throwingClient = new ThrowingMockClient(5, [])

      const factory: AgentClientFactory = {
        create: () => throwingClient,
      }

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, logger)

      // Default is 3, so 4 calls total (3 retries + 1 initial)
      expect(throwingClient.getCallCount()).toBe(4)
      expect(result.exitReason).toBe('max_retries_exceeded')
      if (result.exitReason === 'max_retries_exceeded') {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('Unified exit point', () => {
    it('should call logOverall exactly once for all exit reasons', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      await runner.run(factory, logger, statusReader)

      const overallLogs = logger
        .getEntries()
        .filter((e) => e.message.includes('Overall:'))
      expect(overallLogs.length).toBe(1)
    })

    it('should return consistent result structure regardless of exit reason', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
        delayBetweenSessions: 0,
      })

      const result = await runner.run(factory, silentLogger)

      // All expected properties should be present
      expect(result).toHaveProperty('iterations')
      expect(result).toHaveProperty('deliverablesPassedCount')
      expect(result).toHaveProperty('deliverablesTotalCount')
      expect(result).toHaveProperty('blockedCount')
      expect(result).toHaveProperty('totalDuration')
      expect(result).toHaveProperty('totalCostUsd')
    })
  })

  describe('ExitReason type', () => {
    it('should use correct exit reason values', () => {
      // ExitReason is now a literal union type, values are strings
      const exitReasons = [
        'all_passed',
        'all_blocked',
        'max_iterations',
        'quota_exceeded',
        'interrupted',
        'max_retries_exceeded',
      ] as const
      expect(exitReasons).toContain('all_passed')
      expect(exitReasons).toContain('all_blocked')
      expect(exitReasons).toContain('max_iterations')
      expect(exitReasons).toContain('quota_exceeded')
      expect(exitReasons).toContain('interrupted')
      expect(exitReasons).toContain('max_retries_exceeded')
    })
  })

  describe('Quota handling', () => {
    it('SR-Q001: waits for quota reset when waitForQuota is true', async () => {
      const client = new MockAgentClient()
      // First session: quota exceeded with reset time
      // Second session: success
      const resetTime = new Date(Date.now() + 10) // 10ms from now
      client.setResponsesPerSession([
        [createMockQuotaExceededStreamEnd('Quota exceeded', resetTime)],
        [createMockStreamEnd('done', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        waitForQuota: true,
      })

      const result = await runner.run(factory, logger, statusReader)

      // All deliverables passed after quota wait
      expect(result.deliverablesPassedCount).toBe(1)
      expect(logger.hasMessage('Quota exceeded, waiting')).toBe(true)
    })

    it('SR-Q002: exits immediately when quota exceeded without waitForQuota', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockQuotaExceededStreamEnd('Quota exceeded')])
      const factory = createMockClientFactory(client)

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        waitForQuota: false,
      })

      const result = await runner.run(factory, logger)

      // Quota exceeded without wait
      expect(result.exitReason).toBe('quota_exceeded')
      expect(logger.hasMessage('Quota exceeded')).toBe(true)
    })

    it('SR-Q003: reports waiting events through activityReporter during quota wait', async () => {
      const client = new MockAgentClient()
      const resetTime = new Date(Date.now() + 10)
      client.setResponsesPerSession([
        [createMockQuotaExceededStreamEnd('Quota exceeded', resetTime)],
        [createMockStreamEnd('done', 0.01)],
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
      ])

      const waitingEvents: Array<{
        type: string
        remainingMs: number
        resetTime: Date
      }> = []
      const onStreamEvent = vi.fn((event: { type: string }) => {
        if (event.type === 'stream_waiting') {
          waitingEvents.push(
            event as { type: string; remainingMs: number; resetTime: Date },
          )
        }
      })

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        waitForQuota: true,
        onStreamEvent,
      })

      await runner.run(factory, silentLogger, statusReader)

      // Check that waiting events were reported
      expect(waitingEvents.length).toBeGreaterThan(0)
      expect(waitingEvents[0]).toMatchObject({
        type: 'stream_waiting',
        remainingMs: expect.any(Number),
        resetTime: expect.any(Date),
      })
    })

    it('SR-Q004: timer error propagates correctly', async () => {
      const client = new MockAgentClient()
      const resetTime = new Date(Date.now() + 10)
      client.setResponses([
        createMockQuotaExceededStreamEnd('Quota exceeded', resetTime),
      ])
      const factory = createMockClientFactory(client)

      const onStreamEvent = vi.fn()

      const mockTimer = {
        delay: vi.fn().mockRejectedValue(new Error('Timer error')),
      }

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        waitForQuota: true,
        onStreamEvent,
        timer: mockTimer,
      })

      await expect(runner.run(factory, silentLogger)).rejects.toThrow(
        'Timer error',
      )
    })

    it('SR-Q005: can be interrupted during quota wait', async () => {
      const client = new MockAgentClient()
      const resetTime = new Date(Date.now() + 60000) // 1 minute from now
      client.setResponses([
        createMockQuotaExceededStreamEnd('Quota exceeded', resetTime),
      ])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.pending('DL-001', 'Test', ['AC'])]),
      ])

      const controller = new AbortController()

      // Mock timer that respects abort signal
      const mockTimer = {
        delay: vi.fn((ms: number, signal?: AbortSignal): Promise<void> => {
          return new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(resolve, ms)
            signal?.addEventListener(
              'abort',
              () => {
                clearTimeout(timeoutId)
                reject(new DOMException('Aborted', 'AbortError'))
              },
              { once: true },
            )
          })
        }),
      }

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        waitForQuota: true,
        timer: mockTimer,
      })

      // Abort after a short delay to simulate Ctrl+C during wait
      setTimeout(() => controller.abort(), 10)

      const result = await runner.run(
        factory,
        logger,
        statusReader,
        undefined,
        controller.signal,
      )

      // Should have been interrupted during quota wait
      expect(result.exitReason).toBe('interrupted')
      expect(logger.hasMessage('User interrupted')).toBe(true)
      expect(logger.hasMessage('Quota exceeded, waiting')).toBe(true)
    })
  })

  describe('Interrupt handling', () => {
    it('SR-I001: terminates when signal is aborted before session', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const controller = new AbortController()
      controller.abort() // Abort before running

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
      })

      const result = await runner.run(
        factory,
        logger,
        undefined,
        undefined,
        controller.signal,
      )

      // Interrupted before any session ran
      expect(result.exitReason).toBe('interrupted')
      expect(result.iterations).toBe(0)
      expect(logger.hasMessage('User interrupted')).toBe(true)
    })
  })

  describe('Sync mode output format', () => {
    it('SR-S001: outputs verified format for sync command', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.pending('DL-001', 'Test 1', ['AC']),
          Deliverable.pending('DL-002', 'Test 2', ['AC']),
          Deliverable.pending('DL-003', 'Test 3', ['AC']),
        ]),
      ])

      // Create tracker with 3 deliverables, mark 2 as verified
      const tracker = VerificationTracker.fromIds([
        'DL-001',
        'DL-002',
        'DL-003',
      ])
      tracker.verify('DL-001')
      tracker.verify('DL-002')

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        maxIterations: 1,
        delayBetweenSessions: 0,
        useSyncTermination: true,
        getVerificationTracker: () => tracker,
      })

      await runner.run(factory, logger, statusReader)

      // Should output "2/3 verified" not "deliverables passed"
      expect(logger.hasMessage('2/3 verified')).toBe(true)
      expect(logger.hasMessage('deliverables passed')).toBe(false)
    })

    it('SR-S002: outputs all_verified termination message', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.pending('DL-001', 'Test 1', ['AC']),
          Deliverable.pending('DL-002', 'Test 2', ['AC']),
        ]),
      ])

      // Create tracker and verify all deliverables
      const tracker = VerificationTracker.fromIds(['DL-001', 'DL-002'])
      tracker.verify('DL-001')
      tracker.verify('DL-002')

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        useSyncTermination: true,
        getVerificationTracker: () => tracker,
      })

      const result = await runner.run(factory, logger, statusReader)

      expect(result.exitReason).toBe('all_verified')
      expect(logger.hasMessage('All 2 deliverables verified')).toBe(true)
    })

    it('SR-S003: result includes verifiedCount and verifiedTotalCount', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([
          Deliverable.pending('DL-001', 'Test 1', ['AC']),
          Deliverable.pending('DL-002', 'Test 2', ['AC']),
          Deliverable.pending('DL-003', 'Test 3', ['AC']),
        ]),
      ])

      const tracker = VerificationTracker.fromIds([
        'DL-001',
        'DL-002',
        'DL-003',
      ])
      tracker.verify('DL-001')
      tracker.verify('DL-002')
      tracker.verify('DL-003')

      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        useSyncTermination: true,
        getVerificationTracker: () => tracker,
      })

      const result = await runner.run(factory, silentLogger, statusReader)

      expect(result.verifiedCount).toBe(3)
      expect(result.verifiedTotalCount).toBe(3)
    })

    it('SR-S004: run command still outputs deliverables passed format', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])
      const factory = createMockClientFactory(client)

      const statusReader = new MockDeliverableStatusReader()
      statusReader.setStatusSequence([
        createMockStatusJson([Deliverable.passed('DL-001', 'Test', ['AC'])]),
      ])

      const logger = new TestLogger()
      const runner = new SessionRunner({
        projectDir: '/test/project',
        delayBetweenSessions: 0,
        // useSyncTermination defaults to false (run mode)
      })

      await runner.run(factory, logger, statusReader)

      // Should output "deliverables passed" not "verified"
      expect(logger.hasMessage('deliverables passed')).toBe(true)
      expect(logger.hasMessage('verified')).toBe(false)
    })
  })
})
