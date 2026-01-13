import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SessionRunner,
  type Logger,
  type InstructionResolver,
  type AgentClientFactory,
  type StreamEvent,
  type MessageStream,
  Deliverable,
} from '@autonoe/core'
import { FileDeliverableRepository } from '@autonoe/agent'
import { SyncCommandHandler } from '../src/syncCommandHandler'
import type { ValidatedSyncOptions } from '../src/options'
import type { SyncPhase } from '../src/sync'
import { VERSION } from '../src/version'

// Mock Logger for capturing output
function createMockLogger(): Logger & {
  infoMessages: string[]
  errorMessages: string[]
} {
  const infoMessages: string[] = []
  const errorMessages: string[] = []
  return {
    infoMessages,
    errorMessages,
    info: vi.fn((msg: string) => infoMessages.push(msg)),
    debug: vi.fn(),
    warn: vi.fn(),
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

// Instruction resolver that tracks which phases were requested
function createTrackingInstructionResolver(): InstructionResolver & {
  resolvedPhases: string[]
} {
  const resolvedPhases: string[] = []
  return {
    resolvedPhases,
    async resolve(name) {
      resolvedPhases.push(name)
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
    instructionResolver?: InstructionResolver
    createClientFactory?: (phase: SyncPhase) => AgentClientFactory
    createSessionRunner?: () => SessionRunner
    abortSignal?: AbortSignal
  }) {
    const options = { ...createBaseOptions(), ...overrides?.options }
    const logger = overrides?.logger ?? createMockLogger()
    const repository = new FileDeliverableRepository(tempDir)
    const instructionResolver =
      overrides?.instructionResolver ?? createTrackingInstructionResolver()
    const createClientFactory =
      overrides?.createClientFactory ?? (() => createMockClientFactory())
    const createSessionRunner =
      overrides?.createSessionRunner ??
      (() =>
        new SessionRunner({
          projectDir: tempDir,
          maxIterations: 1,
          delayBetweenSessions: 0,
        }))
    const abortSignal = overrides?.abortSignal ?? new AbortController().signal

    return new SyncCommandHandler(
      options,
      logger,
      repository,
      instructionResolver,
      createClientFactory,
      createSessionRunner,
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

  describe('two-phase execution', () => {
    it('SCH-010: executes sync phase followed by verify phase', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Phase 1: Syncing')),
      ).toBe(true)
      expect(
        logger.infoMessages.some((m) => m.includes('Phase 2: Verifying')),
      ).toBe(true)
    })

    it('SCH-011: uses correct instruction for each phase', async () => {
      const instructionResolver = createTrackingInstructionResolver()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ instructionResolver })
      await handler.execute()

      // Should resolve 'sync' for phase 1 and 'verify' for phase 2
      expect(instructionResolver.resolvedPhases).toContain('sync')
      expect(instructionResolver.resolvedPhases).toContain('verify')
    })

    it('SCH-012: creates separate client factory for each phase', async () => {
      const phasesCalled: SyncPhase[] = []
      const createClientFactory = (phase: SyncPhase) => {
        phasesCalled.push(phase)
        return createMockClientFactory()
      }

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ createClientFactory })
      await handler.execute()

      expect(phasesCalled).toContain('sync')
      expect(phasesCalled).toContain('verify')
    })

    it('SCH-013: does not proceed to verify if sync is interrupted', async () => {
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
      expect(
        logger.infoMessages.some((m) => m.includes('Phase 2: Verifying')),
      ).toBe(false)
    })

    it('SCH-014: proceeds to verify even when sync reaches max iterations', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      // Should still proceed to verify phase
      expect(
        logger.infoMessages.some((m) => m.includes('Phase 2: Verifying')),
      ).toBe(true)
    })
  })

  describe('phase results', () => {
    it('SCH-020: logs phase completion details', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Sync phase completed')),
      ).toBe(true)
      expect(
        logger.infoMessages.some((m) => m.includes('Verify phase completed')),
      ).toBe(true)
    })

    it('SCH-021: logs deliverable counts', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(logger.infoMessages.some((m) => m.includes('Deliverables:'))).toBe(
        true,
      )
    })

    it('SCH-022: logs blocked count when present', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.blocked('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(logger.infoMessages.some((m) => m.includes('Blocked:'))).toBe(true)
    })

    it('SCH-023: logs success when all deliverables verified', async () => {
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
  })

  describe('error handling', () => {
    it('SCH-030: exits with code 1 when all blocked in sync phase', async () => {
      const logger = createMockLogger()
      createStatusFile([Deliverable.blocked('DL-001', 'Test', ['AC'])])

      const handler = createHandler({ logger })
      await handler.execute()

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
