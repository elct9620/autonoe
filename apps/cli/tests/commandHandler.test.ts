import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SessionRunner,
  DefaultInstructionSelector,
  type Delay,
  type Logger,
  type InstructionResolver,
  type InstructionSelector,
  type AgentClientFactory,
  type StreamEvent,
  type MessageStream,
  Deliverable,
} from '@autonoe/core'

// Mock delay for testing - resolves immediately
const mockDelay: Delay = async () => {}
import { FileDeliverableRepository } from '@autonoe/agent'
import {
  CommandHandler,
  VERSION,
  type CommandHandlerConfig,
} from '../src/commandHandler'
import { SyncInstructionSelector } from '../src/syncInstructionSelector'
import {
  sandboxEnabled,
  sandboxDisabledByCli,
  sandboxDisabledByEnv,
  DEFAULT_CODING_MODEL,
  DEFAULT_PLANNING_MODEL,
  type SandboxMode,
  type ValidatedCommonOptions,
} from '../src/options'

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

// Mock AgentClient that completes immediately
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

// Simple instruction resolver and selector
function createTestInstructionResolver(): InstructionResolver {
  return {
    async resolve() {
      return 'Test instruction'
    },
  }
}

function createTestInstructionSelector(): InstructionSelector {
  return new DefaultInstructionSelector(createTestInstructionResolver())
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

describe('CommandHandler', () => {
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

  function createBaseOptions(): ValidatedCommonOptions {
    return {
      projectDir: tempDir,
      debug: false,
      sandboxMode: sandboxEnabled(),
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

  const runConfig: CommandHandlerConfig = {
    messagePrefix: 'Session',
    startupMessage: 'Starting coding agent session...',
    allowDestructive: false,
  }

  const syncConfig: CommandHandlerConfig = {
    messagePrefix: 'Sync',
    startupMessage: 'Starting sync mode...',
    allowDestructive: false,
  }

  describe('run mode (RCH tests)', () => {
    describe('execute', () => {
      it('RCH-001: logs startup info with version', async () => {
        const options = createBaseOptions()
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
          new AbortController().signal,
        )

        await handler.execute()

        expect(logger.infoMessages).toContain(`Autonoe v${VERSION}`)
        expect(logger.infoMessages).toContain(
          'Starting coding agent session...',
        )
        expect(logger.infoMessages.some((m) => m.includes(tempDir))).toBe(true)
      })

      it('RCH-002: logs max iterations when specified', async () => {
        const options = { ...createBaseOptions(), maxIterations: 10 }
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
          new AbortController().signal,
        )

        await handler.execute()

        expect(
          logger.infoMessages.some((m) => m.includes('Max iterations: 10')),
        ).toBe(true)
      })

      it('RCH-003: logs default models when not specified', async () => {
        const options = createBaseOptions()
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
          new AbortController().signal,
        )

        await handler.execute()

        expect(
          logger.infoMessages.some((m) =>
            m.includes(`Plan model: ${DEFAULT_PLANNING_MODEL}`),
          ),
        ).toBe(true)
        expect(
          logger.infoMessages.some((m) =>
            m.includes(`Model: ${DEFAULT_CODING_MODEL}`),
          ),
        ).toBe(true)
      })

      it('RCH-005: logs custom plan model when specified', async () => {
        const options = { ...createBaseOptions(), planModel: 'custom-opus' }
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
          new AbortController().signal,
        )

        await handler.execute()

        expect(
          logger.infoMessages.some((m) =>
            m.includes('Plan model: custom-opus'),
          ),
        ).toBe(true)
      })

      it('RCH-006: logs custom model when specified', async () => {
        const options = { ...createBaseOptions(), model: 'claude-3-opus' }
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
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
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
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
          delay: mockDelay,
          maxIterations: 1,
          delayBetweenSessions: 0,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
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
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.blocked('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
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
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

        const abortController = new AbortController()
        abortController.abort()

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
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
          delay: mockDelay,
          maxIterations: 1,
          waitForQuota: false,
        })

        createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory({ responsesToReturn: 'quota_exceeded' }),
          createTestInstructionSelector(),
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
          delay: mockDelay,
          maxIterations: 1,
          delayBetweenSessions: 0,
        })

        createStatusFile([Deliverable.pending('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory({ responsesToReturn: 'max_iterations' }),
          createTestInstructionSelector(),
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
          sandboxMode: sandboxDisabledByCli(),
        }
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
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
          sandboxMode: sandboxDisabledByEnv(),
        }
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
          new AbortController().signal,
        )

        await handler.execute()

        expect(logger.warnMessages).toContain(
          'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.',
        )
      })

      it('RCH-022: logs destructive warning when enabled', async () => {
        const options = createBaseOptions()
        const logger = createMockLogger()
        const repository = new FileDeliverableRepository(tempDir)
        const sessionRunner = new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const configWithDestructive: CommandHandlerConfig = {
          ...runConfig,
          allowDestructive: true,
        }

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          configWithDestructive,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
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
          delay: mockDelay,
          maxIterations: 1,
        })

        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = new CommandHandler(
          options,
          options.sandboxMode,
          runConfig,
          logger,
          repository,
          sessionRunner,
          createMockClientFactory(),
          createTestInstructionSelector(),
          new AbortController().signal,
        )

        await handler.execute()

        expect(logger.warnMessages).toHaveLength(0)
      })
    })
  })

  describe('sync mode (SCH tests)', () => {
    function createHandler(overrides?: {
      options?: Partial<ValidatedCommonOptions>
      logger?: Logger
      sessionRunner?: SessionRunner
      clientFactory?: AgentClientFactory
      instructionSelector?: InstructionSelector
      abortSignal?: AbortSignal
    }) {
      const options = { ...createBaseOptions(), ...overrides?.options }
      const sandboxMode = options.sandboxMode
      const logger = overrides?.logger ?? createMockLogger()
      const repository = new FileDeliverableRepository(tempDir)
      const sessionRunner =
        overrides?.sessionRunner ??
        new SessionRunner({
          projectDir: tempDir,
          delay: mockDelay,
          maxIterations: 2,
          delayBetweenSessions: 0,
        })
      const clientFactory =
        overrides?.clientFactory ?? createMockClientFactory()
      const instructionSelector =
        overrides?.instructionSelector ??
        new SyncInstructionSelector(createTrackingInstructionResolver())
      const abortSignal = overrides?.abortSignal ?? new AbortController().signal

      return new CommandHandler(
        options,
        sandboxMode,
        syncConfig,
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

      it('SCH-003: logs default models when not specified', async () => {
        const logger = createMockLogger()
        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = createHandler({ logger })
        await handler.execute()

        expect(
          logger.infoMessages.some((m) =>
            m.includes(`Plan model: ${DEFAULT_PLANNING_MODEL}`),
          ),
        ).toBe(true)
        expect(
          logger.infoMessages.some((m) =>
            m.includes(`Model: ${DEFAULT_CODING_MODEL}`),
          ),
        ).toBe(true)
      })

      it('SCH-005: logs custom plan model when specified', async () => {
        const logger = createMockLogger()
        createStatusFile([Deliverable.passed('DL-001', 'Test', ['AC'])])

        const handler = createHandler({
          options: { planModel: 'custom-opus' },
          logger,
        })
        await handler.execute()

        expect(
          logger.infoMessages.some((m) =>
            m.includes('Plan model: custom-opus'),
          ),
        ).toBe(true)
      })

      it('SCH-006: logs custom model when specified', async () => {
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
            delay: mockDelay,
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
          options: { sandboxMode: sandboxDisabledByEnv() },
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
          options: { sandboxMode: sandboxEnabled() },
        })
        await handler.execute()

        expect(logger.warnMessages).toHaveLength(0)
      })
    })
  })
})
