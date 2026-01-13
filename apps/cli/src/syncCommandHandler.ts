import type {
  SessionRunner,
  SessionRunnerResult,
  AgentClientFactory,
  InstructionResolver,
  DeliverableStatusReader,
  Logger,
  InstructionName,
} from '@autonoe/core'
import type { ValidatedSyncOptions } from './options'
import type { SyncPhase } from './sync'
import { VERSION } from './version'

export { VERSION }

/**
 * Handler for the 'sync' command
 *
 * Implements two-phase execution:
 * 1. Sync phase: Parse SPEC.md and sync deliverables structure
 * 2. Verify phase: Validate implementation and update passed status
 *
 * @see SPEC.md Section 8.3
 */
export class SyncCommandHandler {
  constructor(
    private readonly options: ValidatedSyncOptions,
    private readonly logger: Logger,
    private readonly repository: DeliverableStatusReader,
    private readonly instructionResolver: InstructionResolver,
    private readonly createClientFactory: (
      phase: SyncPhase,
    ) => AgentClientFactory,
    private readonly createSessionRunner: () => SessionRunner,
    private readonly abortSignal: AbortSignal,
  ) {}

  /**
   * Execute the sync command with two-phase flow
   */
  async execute(): Promise<void> {
    this.logStartupInfo()

    // Phase 1: SYNC
    this.logger.info('Phase 1: Syncing deliverables from SPEC.md...')
    this.logger.info('')
    const syncResult = await this.runPhase('sync')

    this.logger.info('')
    this.logPhaseResult('Sync', syncResult)

    if (!this.shouldProceedToVerify(syncResult)) {
      this.handleSyncFailure(syncResult)
      return
    }

    // Phase 2: VERIFY
    this.logger.info('')
    this.logger.info('Phase 2: Verifying implementation status...')
    this.logger.info('')
    const verifyResult = await this.runPhase('verify')

    this.logger.info('')
    this.logPhaseResult('Verify', verifyResult)
    this.handleVerifyResult(verifyResult)
  }

  /**
   * Run a single phase of the sync command
   */
  private async runPhase(phase: SyncPhase): Promise<SessionRunnerResult> {
    const clientFactory = this.createClientFactory(phase)
    const sessionRunner = this.createSessionRunner()
    const fixedResolver = this.createFixedInstructionResolver(phase)

    return sessionRunner.run(
      clientFactory,
      this.logger,
      this.repository,
      fixedResolver,
      this.abortSignal,
    )
  }

  /**
   * Create an InstructionResolver that always returns the specified phase instruction
   *
   * This overrides selectInstruction's behavior which depends on status.json existence.
   * For sync command, we need to explicitly use 'sync' or 'verify' instructions.
   */
  private createFixedInstructionResolver(
    phase: SyncPhase,
  ): InstructionResolver {
    return {
      resolve: async (_name: InstructionName) =>
        this.instructionResolver.resolve(phase),
    }
  }

  /**
   * Determine if sync phase succeeded enough to proceed to verify
   */
  private shouldProceedToVerify(result: SessionRunnerResult): boolean {
    // Proceed if sync completed successfully or reached max iterations
    // (max iterations still means some progress was made)
    return (
      result.exitReason === 'all_passed' ||
      result.exitReason === 'max_iterations'
    )
  }

  private logStartupInfo(): void {
    const { logger, options } = this
    logger.info(`Autonoe v${VERSION}`)
    logger.info('')
    logger.info('Starting sync mode (two-phase execution)')
    logger.info(`  Working directory: ${options.projectDir}`)
    if (options.maxIterations) {
      logger.info(`  Max iterations: ${options.maxIterations}`)
    }
    if (options.model) {
      logger.info(`  Model: ${options.model}`)
    }
    if (options.maxThinkingTokens) {
      logger.info(`  Thinking: ${options.maxThinkingTokens} tokens`)
    }
    logger.info('')
  }

  private logPhaseResult(phase: string, result: SessionRunnerResult): void {
    const { logger } = this
    logger.info(`${phase} phase completed:`)
    logger.info(`  Exit reason: ${result.exitReason}`)
    logger.info(
      `  Deliverables: ${result.deliverablesPassedCount}/${result.deliverablesTotalCount} passed`,
    )
    if (result.blockedCount > 0) {
      logger.info(`  Blocked: ${result.blockedCount}`)
    }
    logger.info(`  Iterations: ${result.iterations}`)
    logger.info(`  Cost: $${result.totalCostUsd.toFixed(4)}`)
  }

  private handleSyncFailure(result: SessionRunnerResult): void {
    switch (result.exitReason) {
      case 'interrupted':
        this.logger.info('Sync interrupted by user')
        break
      case 'quota_exceeded':
        this.logger.error('Sync stopped: quota exceeded')
        process.exit(1)
      case 'max_retries_exceeded':
        this.logger.error(`Sync stopped: ${result.error}`)
        process.exit(1)
      case 'all_blocked':
        this.logger.error('Sync failed: all deliverables blocked')
        process.exit(1)
    }
  }

  private handleVerifyResult(result: SessionRunnerResult): void {
    switch (result.exitReason) {
      case 'interrupted':
        this.logger.info('Verification interrupted by user')
        break
      case 'quota_exceeded':
        this.logger.error('Verification stopped: quota exceeded')
        process.exit(1)
      case 'max_retries_exceeded':
        this.logger.error(`Verification stopped: ${result.error}`)
        process.exit(1)
      case 'all_passed':
        this.logger.info('Sync completed: all deliverables verified')
        break
      case 'all_blocked':
        this.logger.error('Verification failed: all deliverables blocked')
        process.exit(1)
      case 'max_iterations':
        this.logger.info('Verification stopped: max iterations reached')
        break
    }
  }
}
