import type { Logger } from '@autonoe/core'
import type { ValidatedSyncOptions } from './options'
import { VERSION } from './version'

/**
 * Handler for the 'sync' command
 *
 * Receives all dependencies via constructor (DI pattern).
 */
export class SyncCommandHandler {
  constructor(
    private readonly options: ValidatedSyncOptions,
    private readonly logger: Logger,
  ) {}

  /**
   * Execute the sync command
   */
  async execute(): Promise<void> {
    this.logStartupInfo()

    // Dummy message - actual implementation pending
    this.logger.info('Sync command is not yet implemented.')
    this.logger.info('This is a placeholder for future development.')
  }

  private logStartupInfo(): void {
    const { logger, options } = this
    logger.info(`Autonoe v${VERSION}`)
    logger.info('')
    logger.info('Syncing deliverables from SPEC.md...')
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
