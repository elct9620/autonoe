import type {
  SessionRunner,
  SessionRunnerResult,
  AgentClientFactory,
  InstructionResolver,
  DeliverableStatusReader,
  Logger,
} from '@autonoe/core'
import type { ValidatedRunOptions } from './options'
import { logSecurityWarnings } from './options'

/**
 * Version constant - should match package.json
 */
export const VERSION = '0.2.1' // x-release-please-version

/**
 * Handler for the 'run' command
 *
 * Receives all dependencies via constructor (DI pattern).
 * Entrypoint (run.ts) is responsible for initializing and injecting dependencies.
 */
export class RunCommandHandler {
  constructor(
    private readonly options: ValidatedRunOptions,
    private readonly logger: Logger,
    private readonly repository: DeliverableStatusReader,
    private readonly sessionRunner: SessionRunner,
    private readonly clientFactory: AgentClientFactory,
    private readonly instructionResolver: InstructionResolver,
    private readonly abortSignal: AbortSignal,
  ) {}

  /**
   * Execute the run command
   */
  async execute(): Promise<void> {
    this.logSecurityWarnings()
    this.logStartupInfo()

    const result = await this.sessionRunner.run(
      this.clientFactory,
      this.logger,
      this.repository,
      this.instructionResolver,
      this.abortSignal,
    )

    this.logger.info('')
    this.handleResult(result)
  }

  private logSecurityWarnings(): void {
    logSecurityWarnings(this.options.sandboxMode, this.options.allowDestructive)
  }

  private logStartupInfo(): void {
    const { logger, options } = this
    logger.info(`Autonoe v${VERSION}`)
    logger.info('')
    logger.info('Starting coding agent session...')
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
        this.logger.info('Session interrupted by user')
        break
      case 'quota_exceeded':
        this.logger.error('Session stopped: quota exceeded')
        process.exit(1)
      case 'max_retries_exceeded':
        this.logger.error(`Session stopped: ${result.error}`)
        process.exit(1)
      case 'all_passed':
        this.logger.info('Session completed successfully')
        break
      case 'all_blocked':
        this.logger.error('All deliverables blocked')
        process.exit(1)
      case 'max_iterations':
        this.logger.info('Session stopped: max iterations reached')
        break
    }
  }
}
