import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SessionRunner,
  type Logger,
  type InstructionResolver,
  type InstructionSelector,
  type AgentClientFactory,
  type StreamEvent,
  type MessageStream,
  Deliverable,
} from '@autonoe/core'
import { FileDeliverableRepository } from '@autonoe/agent'
import { SyncCommandHandler } from '../src/syncCommandHandler'
import { SyncInstructionSelector } from '../src/syncInstructionSelector'
import { SandboxMode, type ValidatedSyncOptions } from '../src/options'
import { VERSION } from '../src/version'

// Mock Logger for capturing output
function createMockLogger(): Logger & {
  infoMessages: string[]
  warnMessages: string[]
  errorMessages: string[]
} {
  const infoMessages: string[] = []
  const warnMessages: string[] = []
  const errorMessages: string[] = []
  return {
    infoMessages,
    warnMessages,
    errorMessages,
    info: vi.fn((msg: string) => infoMessages.push(msg)),
    debug: vi.fn(),
    warn: vi.fn((msg: string) => warnMessages.push(msg)),
    error: vi.fn((msg: string) => errorMessages.push(msg)),
  }
}

// Mock AgentClient that completes immediately
function createMockClientFactory(): AgentClientFactory {
  return {
    create: () => ({
      query: (): MessageStream => {
        const events: StreamEvent[] = [
          { type: 'stream_end', outcome: 'completed' },
        ]

        const generator = (async function* () {
          for (const event of events) {
            yield event
          }
        })()

        const stream = generator as MessageStream
        stream.interrupt = async () => {}
        return stream
      },
      dispose: async () => {},
    }),
  }
}

// Instruction resolver that tracks which instructions were requested
function createTrackingInstructionResolver(): InstructionResolver & {
  resolvedNames: string[]
} {
  const resolvedNames: string[] = []
  return {
    resolvedNames,
    async resolve(name) {
      resolvedNames.push(name)
      return `Test instruction for ${name}`
    },
  }
}

describe('SyncCommandHandler', () => {
  let tempDir: string
  let processExitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    processExitSpy.mockRestore()
  })

  function createBaseOptions(): ValidatedSyncOptions {
    return {
      projectDir: tempDir,
      debug: false,
      waitForQuota: false,
      sandboxMode: SandboxMode.enabled(),
    }
  }

  function createStatusFile(deliverables: Deliverable[]): void {
    const autonoeDir = join(tempDir, '.autonoe')
    mkdirSync(autonoeDir, { recursive: true })

    const json = {
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      deliverables: deliverables.map((d) => ({
        id: d.id,
        description: d.description,
        acceptanceCriteria: [...d.acceptanceCriteria],
        passed: d.passed,
        blocked: d.blocked,
      })),
    }
    writeFileSync(
      join(autonoeDir, 'status.json'),
      JSON.stringify(json, null, 2),
    )
  }

  function createHandler(overrides?: {
    options?: Partial<ValidatedSyncOptions>
    logger?: Logger
    sessionRunner?: SessionRunner
    clientFactory?: AgentClientFactory
    instructionSelector?: InstructionSelector
    abortSignal?: AbortSignal
  }) {
    const options = { ...createBaseOptions(), ...overrides?.options }
    const logger = overrides?.logger ?? createMockLogger()
    const repository = new FileDeliverableRepository(tempDir)
    const sessionRunner =
      overrides?.sessionRunner ??
      new SessionRunner({
        projectDir: tempDir,
        maxIterations: 2,
        delayBetweenSessions: 0,
      })
    const clientFactory = overrides?.clientFactory ?? createMockClientFactory()
    const instructionSelector =
      overrides?.instructionSelector ??
      new SyncInstructionSelector(createTrackingInstructionResolver())
    const abortSignal = overrides?.abortSignal ?? new AbortController().signal

    return new SyncCommandHandler(
      options,
      logger,
      repository,
      sessionRunner,
      clientFactory,
      instructionSelector,
      abortSignal,
    )
  }

  describe('execute', () => {
    it('SCH-001: logs startup info with version', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(logger.infoMessages).toContain(`Autonoe v${VERSION}`)
      expect(
        logger.infoMessages.some((m) => m.includes('Starting sync mode')),
      ).toBe(true)
      expect(logger.infoMessages.some((m) => m.includes(tempDir))).toBe(true)
    })

    it('SCH-002: logs max iterations when specified', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({
        options: { maxIterations: 5 },
        logger,
      })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Max iterations: 5')),
      ).toBe(true)
    })

    it('SCH-003: logs model when specified', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({
        options: { model: 'claude-3-opus' },
        logger,
      })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Model: claude-3-opus')),
      ).toBe(true)
    })

    it('SCH-004: logs thinking tokens when specified', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({
        options: { maxThinkingTokens: 16384 },
        logger,
      })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Thinking: 16384 tokens')),
      ).toBe(true)
    })
  })

  describe('instruction selection', () => {
    it('SCH-010: uses sync instruction for first session, verify for subsequent', async () => {
      const instructionResolver = createTrackingInstructionResolver()
      const instructionSelector = new SyncInstructionSelector(
        instructionResolver,
      )
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ instructionSelector })
      await handler.execute()

      // First session uses 'sync', second session uses 'verify'
      expect(instructionResolver.resolvedNames[0]).toBe('sync')
      expect(instructionResolver.resolvedNames[1]).toBe('verify')
    })
  })

  describe('result handling', () => {
    it('SCH-020: logs success when all deliverables pass', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) =>
          m.includes('Sync completed: all deliverables verified'),
        ),
      ).toBe(true)
    })

    it('SCH-021: logs interruption when aborted', async () => {
      const logger = createMockLogger()
      const abortController = new AbortController()
      abortController.abort()
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      const handler = createHandler({
        logger,
        abortSignal: abortController.signal,
      })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Sync interrupted')),
      ).toBe(true)
    })

    it('SCH-022: logs max iterations reached', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      const handler = createHandler({
        logger,
        sessionRunner: new SessionRunner({
          projectDir: tempDir,
          maxIterations: 1,
          delayBetweenSessions: 0,
        }),
      })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) =>
          m.includes('Sync stopped: max iterations reached'),
        ),
      ).toBe(true)
    })
  })

  describe('error handling', () => {
    it('SCH-030: exits with code 1 when all blocked', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.blocked('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('SCH-031: exits with code 1 on quota exceeded', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      // Create a mock session runner that returns quota_exceeded
      const mockSessionRunner = {
        run: vi.fn().mockResolvedValue({
          exitReason: 'quota_exceeded',
          iterations: 1,
          deliverablesPassedCount: 0,
          deliverablesTotalCount: 1,
          blockedCount: 0,
          verifiedCount: 0,
          verifiedTotalCount: 1,
          totalDuration: 100,
          totalCostUsd: 0.01,
        }),
      } as unknown as SessionRunner

      const handler = createHandler({
        logger,
        sessionRunner: mockSessionRunner,
      })
      await handler.execute()

      expect(
        logger.errorMessages.some((m) =>
          m.includes('Sync stopped: quota exceeded'),
        ),
      ).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('SCH-032: exits with code 1 on max retries exceeded', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      // Create a mock session runner that returns max_retries_exceeded
      const mockSessionRunner = {
        run: vi.fn().mockResolvedValue({
          exitReason: 'max_retries_exceeded',
          error: 'Connection failed',
          iterations: 1,
          deliverablesPassedCount: 0,
          deliverablesTotalCount: 1,
          blockedCount: 0,
          verifiedCount: 0,
          verifiedTotalCount: 1,
          totalDuration: 100,
          totalCostUsd: 0.01,
        }),
      } as unknown as SessionRunner

      const handler = createHandler({
        logger,
        sessionRunner: mockSessionRunner,
      })
      await handler.execute()

      expect(
        logger.errorMessages.some((m) =>
          m.includes('Sync stopped: Connection failed'),
        ),
      ).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('security warnings', () => {
    it('SCH-040: logs sandbox warning when disabled via env', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({
        logger,
        options: { sandboxMode: SandboxMode.disabledByEnv() },
      })
      await handler.execute()

      expect(
        logger.warnMessages.some((m) =>
          m.includes('AUTONOE_NO_SANDBOX environment variable'),
        ),
      ).toBe(true)
    })

    it('SCH-041: does not log warning when sandbox enabled', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({
        logger,
        options: { sandboxMode: SandboxMode.enabled() },
      })
      await handler.execute()

      expect(logger.warnMessages).toHaveLength(0)
    })
  })
})
