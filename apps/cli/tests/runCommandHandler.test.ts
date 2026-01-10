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
import { RunCommandHandler, VERSION } from '../src/runCommandHandler'
import type { ValidatedRunOptions } from '../src/options'

// Mock Logger for capturing output
function createMockLogger(): Logger & {
  infoMessages: string[]
  errorMessages: string[]
  warnMessages: string[]
} {
  const infoMessages: string[] = []
  const errorMessages: string[] = []
  const warnMessages: string[] = []

  return {
    infoMessages,
    errorMessages,
    warnMessages,
    info: vi.fn((msg: string) => infoMessages.push(msg)),
    debug: vi.fn(),
    warn: vi.fn((msg: string) => warnMessages.push(msg)),
    error: vi.fn((msg: string) => errorMessages.push(msg)),
  }
}

// Mock AgentClient that completes immediately with all_passed
function createMockClientFactory(options?: {
  responsesToReturn?: 'all_passed' | 'quota_exceeded' | 'max_iterations'
}): AgentClientFactory {
  const responseType = options?.responsesToReturn ?? 'all_passed'

  return {
    create: () => ({
      query: (): MessageStream => {
        const events: StreamEvent[] =
          responseType === 'quota_exceeded'
            ? [
                {
                  type: 'stream_end',
                  outcome: 'quota_exceeded',
                  message: 'Rate limit exceeded',
                },
              ]
            : [{ type: 'stream_end', outcome: 'completed' }]

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

// Simple instruction resolver
function createTestInstructionResolver(): InstructionResolver {
  return {
    async resolve() {
      return 'Test instruction'
    },
  }
}

describe('RunCommandHandler', () => {
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

  function createBaseOptions(): ValidatedRunOptions {
    return {
      projectDir: tempDir,
      debug: false,
      sandboxMode: { disabled: false, source: 'default' },
      waitForQuota: false,
      allowDestructive: false,
    }
  }

  function createStatusFile(deliverables: Deliverable[]): void {
    const autonoeDir = join(tempDir, '.autonoe')
    mkdirSync(autonoeDir, { recursive: true })

    // Create proper JSON format expected by FileDeliverableRepository
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

  describe('execute', () => {
    it('RCH-001: logs startup info with version', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      // Create a passed deliverable so session ends immediately
      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(logger.infoMessages).toContain(`Autonoe v${VERSION}`)
      expect(logger.infoMessages).toContain('Starting coding agent session...')
      expect(logger.infoMessages.some((m) => m.includes(tempDir))).toBe(true)
    })

    it('RCH-002: logs max iterations when specified', async () => {
      const options = { ...createBaseOptions(), maxIterations: 10 }
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Max iterations: 10')),
      ).toBe(true)
    })

    it('RCH-003: logs model when specified', async () => {
      const options = { ...createBaseOptions(), model: 'claude-3-opus' }
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Model: claude-3-opus')),
      ).toBe(true)
    })

    it('RCH-004: logs thinking tokens when specified', async () => {
      const options = { ...createBaseOptions(), maxThinkingTokens: 16384 }
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Thinking: 16384 tokens')),
      ).toBe(true)
    })
  })

  describe('handleResult', () => {
    it('RCH-010: logs success message for all_passed', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
        delayBetweenSessions: 0,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(
        logger.infoMessages.some((m) =>
          m.includes('Session completed successfully'),
        ),
      ).toBe(true)
    })

    it('RCH-011: logs error message for all_blocked', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.blocked('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(
        logger.errorMessages.some((m) =>
          m.includes('All deliverables blocked'),
        ),
      ).toBe(true)
    })

    it('RCH-012: logs interrupted message and does not exit', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      // Create a pending deliverable
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      // Create abort controller and abort immediately
      const abortController = new AbortController()
      abortController.abort()

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        abortController.signal,
      )

      await handler.execute()

      expect(
        logger.infoMessages.some((m) =>
          m.includes('Session interrupted by user'),
        ),
      ).toBe(true)
      expect(processExitSpy).not.toHaveBeenCalled()
    })

    it('RCH-013: logs error and exits for quota_exceeded', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
        waitForQuota: false,
      })

      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory({ responsesToReturn: 'quota_exceeded' }),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(
        logger.errorMessages.some((m) => m.includes('quota exceeded')),
      ).toBe(true)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('RCH-014: logs info for max_iterations', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
        delayBetweenSessions: 0,
      })

      // Pending deliverable that won't pass
      createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory({ responsesToReturn: 'max_iterations' }),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(
        logger.infoMessages.some((m) =>
          m.includes('Session stopped: max iterations reached'),
        ),
      ).toBe(true)
    })
  })

  describe('logSecurityWarnings', () => {
    it('RCH-020: logs sandbox warning when disabled via CLI', async () => {
      const options = {
        ...createBaseOptions(),
        sandboxMode: { disabled: true, source: 'cli' as const },
      }
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(logger.warnMessages).toContain(
        'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
      )
    })

    it('RCH-021: logs sandbox warning when disabled via env', async () => {
      const options = {
        ...createBaseOptions(),
        sandboxMode: { disabled: true, source: 'env' as const },
      }
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(logger.warnMessages).toContain(
        'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.',
      )
    })

    it('RCH-022: logs destructive warning when enabled', async () => {
      const options = {
        ...createBaseOptions(),
        allowDestructive: true,
      }
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(logger.warnMessages).toContain(
        'Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.',
      )
    })

    it('RCH-023: logs no warnings when sandbox enabled and no destructive', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner = new SessionRunner({
        projectDir: tempDir,
        maxIterations: 1,
      })

      createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

      const handler = new RunCommandHandler(
        options,
        logger,
        repository,
        sessionRunner,
        createMockClientFactory(),
        createTestInstructionResolver(),
        new AbortController().signal,
      )

      await handler.execute()

      expect(logger.warnMessages).toHaveLength(0)
    })
  })
})
