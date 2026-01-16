import type {
  SessionRunner,
  AgentClientFactory,
  InstructionSelector,
  DeliverableStatusReader,
  Logger,
} from '@autonoe/core'
import type { ValidatedRunOptions } from './options'
import { logSecurityWarnings } from './options'
import { VERSION } from './version'
import { handleSessionResult } from './resultHandler'

export { VERSION }

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
    private readonly instructionSelector: InstructionSelector,
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
      this.instructionSelector,
      this.abortSignal,
    )

    this.logger.info('')
    handleSessionResult(result, this.logger, { messagePrefix: 'Session' })
  }

  private logSecurityWarnings(): void {
    logSecurityWarnings(
      this.logger,
      this.options.sandboxMode,
      this.options.allowDestructive,
    )
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
}
