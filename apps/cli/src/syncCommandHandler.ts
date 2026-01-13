import type {
  SessionRunner,
  SessionRunnerResult,
  AgentClientFactory,
  InstructionSelector,
  DeliverableStatusReader,
  Logger,
} from '@autonoe/core'
import type { ValidatedSyncOptions } from './options'
import { VERSION } from './version'

export { VERSION }

/**
 * Handler for the 'sync' command
 *
 * Uses the same pattern as RunCommandHandler: single SessionRunner loop
 * with dynamic instruction selection via InstructionSelector.
 *
 * Session 1 uses 'sync' instruction to parse SPEC.md and sync deliverables.
 * Session 2+ uses 'verify' instruction to validate implementation.
 *
 * @see SPEC.md Section 8.3
 */
export class SyncCommandHandler {
  constructor(
    private readonly options: ValidatedSyncOptions,
    private readonly logger: Logger,
    private readonly repository: DeliverableStatusReader,
    private readonly sessionRunner: SessionRunner,
    private readonly clientFactory: AgentClientFactory,
    private readonly instructionSelector: InstructionSelector,
    private readonly abortSignal: AbortSignal,
  ) {}

  /**
   * Execute the sync command
   */
  async execute(): Promise<void> {
    this.logStartupInfo()

    const result = await this.sessionRunner.run(
      this.clientFactory,
      this.logger,
      this.repository,
      this.instructionSelector,
      this.abortSignal,
    )

    this.logger.info('')
    this.handleResult(result)
  }

  private logStartupInfo(): void {
    const { logger, options } = this
    logger.info(`Autonoe v${VERSION}`)
    logger.info('')
    logger.info('Starting sync mode...')
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

  private handleResult(result: SessionRunnerResult): void {
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
      case 'all_passed':
        this.logger.info('Sync completed: all deliverables verified')
        break
      case 'all_blocked':
        this.logger.error('All deliverables blocked')
        process.exit(1)
      case 'max_iterations':
        this.logger.info('Sync stopped: max iterations reached')
        break
    }
  }
}
