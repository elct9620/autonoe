import type {
  SessionRunner,
  AgentClientFactory,
  InstructionSelector,
  DeliverableStatusReader,
  Logger,
} from '@autonoe/core'
import type { SandboxMode, ValidatedCommonOptions } from './options'
import { logSecurityWarnings } from './options'
import { VERSION } from './version'
import { handleSessionResult } from './resultHandler'

export { VERSION }

export interface CommandHandlerConfig {
  messagePrefix: string
  startupMessage: string
  allowDestructive: boolean
}

/**
 * Generic command handler for run and sync commands
 *
 * Receives all dependencies via constructor (DI pattern).
 * Entrypoint is responsible for initializing and injecting dependencies.
 */
export class CommandHandler {
  constructor(
    private readonly options: ValidatedCommonOptions,
    private readonly sandboxMode: SandboxMode,
    private readonly config: CommandHandlerConfig,
    private readonly logger: Logger,
    private readonly repository: DeliverableStatusReader,
    private readonly sessionRunner: SessionRunner,
    private readonly clientFactory: AgentClientFactory,
    private readonly instructionSelector: InstructionSelector,
    private readonly abortSignal: AbortSignal,
  ) {}

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
    handleSessionResult(result, this.logger, {
      messagePrefix: this.config.messagePrefix,
    })
  }

  private logSecurityWarnings(): void {
    logSecurityWarnings(
      this.logger,
      this.sandboxMode,
      this.config.allowDestructive,
    )
  }

  private logStartupInfo(): void {
    const { logger, options, config } = this
    logger.info(`Autonoe v${VERSION}`)
    logger.info('')
    logger.info(config.startupMessage)
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
