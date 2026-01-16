import {
  SessionRunner,
  loadConfig,
  DefaultInstructionSelector,
  type Logger,
  type AgentConfig,
  type DeliverableStatusCallback,
} from '@autonoe/core'
import { FileDeliverableRepository } from '@autonoe/agent'
import {
  validateRunOptions,
  validateSyncOptions,
  validatePrerequisites,
  type RunCommandOptions,
  type SyncCommandOptions,
  type ValidatedRunOptions,
  type ValidatedSyncOptions,
} from './options'
import { RunCommandHandler } from './runCommandHandler'
import { SyncCommandHandler } from './syncCommandHandler'
import { ConsoleLogger } from './consoleLogger'
import { VERSION } from './version'
import {
  createInstructionResolver,
  createStatusChangeCallback,
  createRunnerOptions,
} from './factories'
import { SyncInstructionSelector } from './syncInstructionSelector'
import { AgentClientFactoryBuilder } from './agentClientFactoryBuilder'
import { defaultProcessExit, type ProcessExitStrategy } from './processExit'

// Re-export for backward compatibility
export { VERSION }
export type { RunCommandOptions, SyncCommandOptions }
export type { ProcessExitStrategy }

interface CommonDependencies {
  logger: Logger
  config: AgentConfig
  repository: FileDeliverableRepository
  onStatusChange: DeliverableStatusCallback
  abortController: AbortController
}

type ValidationResult<T> =
  | { success: true; options: T }
  | { success: false; error: string }

interface CommandConfig<TOptions, TValidated extends { projectDir: string }> {
  validate: (options: TOptions) => ValidationResult<TValidated>
  createHandler: (
    validated: TValidated,
    deps: CommonDependencies,
  ) => { execute(): Promise<void> }
}

async function initializeCommonDependencies(
  projectDir: string,
  logger: Logger,
): Promise<CommonDependencies> {
  const config = await loadConfig(projectDir)
  const repository = new FileDeliverableRepository(projectDir)
  const onStatusChange = createStatusChangeCallback(logger)

  const abortController = new AbortController()
  process.on('SIGINT', () => {
    logger.info('')
    logger.info('Received SIGINT, stopping...')
    abortController.abort()
  })

  return {
    logger,
    config,
    repository,
    onStatusChange,
    abortController,
  }
}

async function executeCommand<
  TOptions extends { debug?: boolean },
  TValidated extends { projectDir: string },
>(
  options: TOptions,
  config: CommandConfig<TOptions, TValidated>,
  processExit: ProcessExitStrategy,
): Promise<void> {
  const logger = new ConsoleLogger({ debug: options.debug })

  const validation = config.validate(options)
  if (!validation.success) {
    logger.error(validation.error)
    processExit.exit(1)
    return
  }
  const validatedOptions = validation.options

  const prereqValidation = validatePrerequisites(validatedOptions.projectDir)
  if (!prereqValidation.success) {
    logger.error(prereqValidation.error)
    processExit.exit(1)
    return
  }

  const deps = await initializeCommonDependencies(
    validatedOptions.projectDir,
    logger,
  )
  const handler = config.createHandler(validatedOptions, deps)

  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(`Error: ${err.message}`, err)
    processExit.exit(1)
  }
}

function createRunHandler(
  options: ValidatedRunOptions,
  deps: CommonDependencies,
): { execute(): Promise<void> } {
  const { factory: clientFactory } = new AgentClientFactoryBuilder()
    .withProjectDir(options.projectDir)
    .withConfig(deps.config)
    .withRepository(deps.repository)
    .withStatusChangeCallback(deps.onStatusChange)
    .withSandboxMode(options.sandboxMode)
    .withModel(options.model)
    .withMaxThinkingTokens(options.maxThinkingTokens)
    .withRunMode(options.allowDestructive)
    .build()

  const runnerOptions = createRunnerOptions(options)
  const sessionRunner = new SessionRunner(runnerOptions)

  const instructionResolver = createInstructionResolver(options.projectDir)
  const instructionSelector = new DefaultInstructionSelector(
    instructionResolver,
  )

  return new RunCommandHandler(
    options,
    deps.logger,
    deps.repository,
    sessionRunner,
    clientFactory,
    instructionSelector,
    deps.abortController.signal,
  )
}

function createSyncHandler(
  options: ValidatedSyncOptions,
  deps: CommonDependencies,
): { execute(): Promise<void> } {
  const { factory: clientFactory, getVerificationTracker } =
    new AgentClientFactoryBuilder()
      .withProjectDir(options.projectDir)
      .withConfig(deps.config)
      .withRepository(deps.repository)
      .withStatusChangeCallback(deps.onStatusChange)
      .withSandboxMode(options.sandboxMode)
      .withModel(options.model)
      .withMaxThinkingTokens(options.maxThinkingTokens)
      .withSyncMode()
      .build()

  const runnerOptions = createRunnerOptions(options)
  const sessionRunner = new SessionRunner({
    ...runnerOptions,
    useSyncTermination: true,
    getVerificationTracker,
  })

  const instructionResolver = createInstructionResolver(options.projectDir)
  const instructionSelector = new SyncInstructionSelector(instructionResolver)

  return new SyncCommandHandler(
    options,
    deps.logger,
    deps.repository,
    sessionRunner,
    clientFactory,
    instructionSelector,
    deps.abortController.signal,
  )
}

/**
 * Handle the 'run' command
 */
export async function handleRunCommand(
  options: RunCommandOptions,
  processExit: ProcessExitStrategy = defaultProcessExit,
): Promise<void> {
  await executeCommand(
    options,
    { validate: validateRunOptions, createHandler: createRunHandler },
    processExit,
  )
}

/**
 * Handle the 'sync' command
 *
 * @see SPEC.md Section 8.3
 */
export async function handleSyncCommand(
  options: SyncCommandOptions,
  processExit: ProcessExitStrategy = defaultProcessExit,
): Promise<void> {
  await executeCommand(
    options,
    { validate: validateSyncOptions, createHandler: createSyncHandler },
    processExit,
  )
}
