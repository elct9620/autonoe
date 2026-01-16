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

/**
 * Handle the 'run' command
 *
 * Entrypoint that:
 * 1. Validates options
 * 2. Initializes all dependencies
 * 3. Injects dependencies into Handler
 */
export async function handleRunCommand(
  options: RunCommandOptions,
  processExit: ProcessExitStrategy = defaultProcessExit,
): Promise<void> {
  const logger = new ConsoleLogger({ debug: options.debug })

  // 1. Validate options
  const validation = validateRunOptions(options)
  if (!validation.success) {
    logger.error(validation.error)
    processExit.exit(1)
  }
  const validatedOptions = validation.options

  // 1.5. Check prerequisites (SPEC.md exists)
  const prereqValidation = validatePrerequisites(validatedOptions.projectDir)
  if (!prereqValidation.success) {
    logger.error(prereqValidation.error)
    processExit.exit(1)
  }

  // 2. Initialize all dependencies
  const deps = await initializeCommonDependencies(
    validatedOptions.projectDir,
    logger,
  )

  const { factory: clientFactory } = new AgentClientFactoryBuilder()
    .withProjectDir(validatedOptions.projectDir)
    .withConfig(deps.config)
    .withRepository(deps.repository)
    .withStatusChangeCallback(deps.onStatusChange)
    .withSandboxMode(validatedOptions.sandboxMode)
    .withModel(validatedOptions.model)
    .withMaxThinkingTokens(validatedOptions.maxThinkingTokens)
    .withRunMode(validatedOptions.allowDestructive)
    .build()

  const runnerOptions = createRunnerOptions(validatedOptions)
  const sessionRunner = new SessionRunner(runnerOptions)

  const instructionResolver = createInstructionResolver(
    validatedOptions.projectDir,
  )
  const instructionSelector = new DefaultInstructionSelector(
    instructionResolver,
  )

  // 3. Inject dependencies into Handler
  const handler = new RunCommandHandler(
    validatedOptions,
    logger,
    deps.repository,
    sessionRunner,
    clientFactory,
    instructionSelector,
    deps.abortController.signal,
  )

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
 * Entrypoint that:
 * 1. Validates options
 * 2. Initializes all dependencies
 * 3. Injects dependencies into Handler
 *
 * Uses the same pattern as run command: single SessionRunner with
 * dynamic instruction selection via SyncInstructionSelector.
 *
 * @see SPEC.md Section 8.3
 */
export async function handleSyncCommand(
  options: SyncCommandOptions,
  processExit: ProcessExitStrategy = defaultProcessExit,
): Promise<void> {
  const logger = new ConsoleLogger({ debug: options.debug })

  // 1. Validate options
  const validation = validateSyncOptions(options)
  if (!validation.success) {
    logger.error(validation.error)
    processExit.exit(1)
  }
  const validatedOptions = validation.options

  // 1.5. Check prerequisites (SPEC.md exists)
  const prereqValidation = validatePrerequisites(validatedOptions.projectDir)
  if (!prereqValidation.success) {
    logger.error(prereqValidation.error)
    processExit.exit(1)
  }

  // 2. Initialize all dependencies
  const deps = await initializeCommonDependencies(
    validatedOptions.projectDir,
    logger,
  )

  const { factory: clientFactory, getVerificationTracker } =
    new AgentClientFactoryBuilder()
      .withProjectDir(validatedOptions.projectDir)
      .withConfig(deps.config)
      .withRepository(deps.repository)
      .withStatusChangeCallback(deps.onStatusChange)
      .withSandboxMode(validatedOptions.sandboxMode)
      .withModel(validatedOptions.model)
      .withMaxThinkingTokens(validatedOptions.maxThinkingTokens)
      .withSyncMode()
      .build()

  // Single SessionRunner instance (same pattern as run command)
  const runnerOptions = createRunnerOptions(validatedOptions)
  const sessionRunner = new SessionRunner({
    ...runnerOptions,
    useSyncTermination: true,
    getVerificationTracker,
  })

  // SyncInstructionSelector: session 1 uses 'sync', session 2+ uses 'verify'
  const instructionResolver = createInstructionResolver(
    validatedOptions.projectDir,
  )
  const instructionSelector = new SyncInstructionSelector(instructionResolver)

  // 3. Inject dependencies into Handler (same pattern as run command)
  const handler = new SyncCommandHandler(
    validatedOptions,
    logger,
    deps.repository,
    sessionRunner,
    clientFactory,
    instructionSelector,
    deps.abortController.signal,
  )

  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(`Error: ${err.message}`, err)
    processExit.exit(1)
  }
}
