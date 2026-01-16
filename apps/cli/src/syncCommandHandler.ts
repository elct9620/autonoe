import type {
  SessionRunner,
  AgentClientFactory,
  InstructionSelector,
  DeliverableStatusReader,
  Logger,
} from '@autonoe/core'
import { logSecurityWarnings, type ValidatedSyncOptions } from './options'
import { VERSION } from './version'
import { handleSessionResult } from './resultHandler'

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
    this.logSecurityWarnings()
    this.logStartupInfo()

    const result = await this.sessionRunner.run(
      this.clientFactory,
      this.logger,
      this.repository,
      this.instructionSelector,
      this.abortSignal,
    )

    this.logger.info('')
    handleSessionResult(result, this.logger, { messagePrefix: 'Sync' })
  }

  private logSecurityWarnings(): void {
    logSecurityWarnings(this.logger, this.options.sandboxMode, false)
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
}
