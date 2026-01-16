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
import { CommandHandler } from './commandHandler'
import { ConsoleLogger } from './consoleLogger'
import { VERSION } from './version'
import {
  createInstructionResolver,
  createStatusChangeCallback,
  createRunnerOptions,
} from './factories'
import { SyncInstructionSelector } from './syncInstructionSelector'
import { createAgentClientFactory } from './agentClientFactory'
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

function createRunHandler(
  options: ValidatedRunOptions,
  deps: CommonDependencies,
): { execute(): Promise<void> } {
  const { factory: clientFactory } = createAgentClientFactory({
    projectDir: options.projectDir,
    config: deps.config,
    repository: deps.repository,
    sandboxMode: options.sandboxMode,
    mode: 'run',
    onStatusChange: deps.onStatusChange,
    model: options.model,
    maxThinkingTokens: options.maxThinkingTokens,
    allowDestructive: options.allowDestructive,
  })

  const runnerOptions = createRunnerOptions(options)
  const sessionRunner = new SessionRunner(runnerOptions)

  const instructionResolver = createInstructionResolver(options.projectDir)
  const instructionSelector = new DefaultInstructionSelector(
    instructionResolver,
  )

  return new CommandHandler(
    options,
    options.sandboxMode,
    {
      messagePrefix: 'Session',
      startupMessage: 'Starting coding agent session...',
      allowDestructive: options.allowDestructive,
    },
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
    createAgentClientFactory({
      projectDir: options.projectDir,
      config: deps.config,
      repository: deps.repository,
      sandboxMode: options.sandboxMode,
      mode: 'sync',
      onStatusChange: deps.onStatusChange,
      model: options.model,
      maxThinkingTokens: options.maxThinkingTokens,
    })

  const runnerOptions = createRunnerOptions(options)
  const sessionRunner = new SessionRunner({
    ...runnerOptions,
    useSyncTermination: true,
    getVerificationTracker,
  })

  const instructionResolver = createInstructionResolver(options.projectDir)
  const instructionSelector = new SyncInstructionSelector(instructionResolver)

  return new CommandHandler(
    options,
    options.sandboxMode,
    {
      messagePrefix: 'Sync',
      startupMessage: 'Starting sync mode...',
      allowDestructive: false,
    },
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
  const logger = new ConsoleLogger({ debug: options.debug })

  const validation = validateRunOptions(options)
  if (!validation.success) {
    logger.error(validation.error)
    return processExit.exit(1)
  }

  const prereqValidation = validatePrerequisites(validation.options.projectDir)
  if (!prereqValidation.success) {
    logger.error(prereqValidation.error)
    return processExit.exit(1)
  }

  const deps = await initializeCommonDependencies(
    validation.options.projectDir,
    logger,
  )
  const handler = createRunHandler(validation.options, deps)

  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(`Error: ${err.message}`, err)
    processExit.exit(1)
  }
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
  const logger = new ConsoleLogger({ debug: options.debug })

  const validation = validateSyncOptions(options)
  if (!validation.success) {
    logger.error(validation.error)
    return processExit.exit(1)
  }

  const prereqValidation = validatePrerequisites(validation.options.projectDir)
  if (!prereqValidation.success) {
    logger.error(prereqValidation.error)
    return processExit.exit(1)
  }

  const deps = await initializeCommonDependencies(
    validation.options.projectDir,
    logger,
  )
  const handler = createSyncHandler(validation.options, deps)

  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(`Error: ${err.message}`, err)
    processExit.exit(1)
  }
}
