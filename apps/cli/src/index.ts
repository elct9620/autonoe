import {
  SessionRunner,
  loadConfig,
  createInstructionSelector,
  Workflow,
  SYNC_FIRST_SESSION,
  type AgentConfig,
  type DeliverableStatusCallback,
  type StreamEvent,
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
import { ConsolePresenter } from './consolePresenter'
import { VERSION } from './version'
import {
  createInstructionResolver,
  createStatusChangeCallback,
  createRunnerOptions,
} from './factories'
import { createAgentClientFactory } from './agentClientFactory'
import { defaultProcessExit, type ProcessExitStrategy } from './processExit'
import type { Presenter } from './presenter'

// Re-export for backward compatibility
export { VERSION }
export type { RunCommandOptions, SyncCommandOptions }
export type { ProcessExitStrategy }

interface CommonDependencies {
  presenter: Presenter
  config: AgentConfig
  repository: FileDeliverableRepository
  onStatusChange: DeliverableStatusCallback
  abortController: AbortController
}

async function initializeCommonDependencies(
  projectDir: string,
  presenter: Presenter,
): Promise<CommonDependencies> {
  const config = await loadConfig(projectDir)
  const repository = new FileDeliverableRepository(projectDir)
  const onStatusChange = createStatusChangeCallback(presenter)

  const abortController = new AbortController()
  process.once('SIGINT', () => {
    presenter.info('')
    presenter.info('Received SIGINT, stopping...')
    abortController.abort()
  })

  return {
    presenter,
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
    planModel: options.planModel,
    maxThinkingTokens: options.maxThinkingTokens,
    allowDestructive: options.allowDestructive,
  })

  const onStreamEvent = (event: StreamEvent) => deps.presenter.activity(event)
  const runnerOptions = createRunnerOptions(options, onStreamEvent)
  const sessionRunner = new SessionRunner(runnerOptions)

  const instructionResolver = createInstructionResolver(options.projectDir)
  const instructionSelector = createInstructionSelector(
    Workflow.run,
    instructionResolver,
    async (ctx) => !(await ctx.statusReader.exists()),
  )

  return new CommandHandler(
    options,
    options.sandboxMode,
    {
      messagePrefix: 'Session',
      startupMessage: 'Starting coding agent session...',
      allowDestructive: options.allowDestructive,
    },
    deps.presenter,
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
      planModel: options.planModel,
      maxThinkingTokens: options.maxThinkingTokens,
    })

  const onStreamEvent = (event: StreamEvent) => deps.presenter.activity(event)
  const runnerOptions = createRunnerOptions(options, onStreamEvent)
  const sessionRunner = new SessionRunner({
    ...runnerOptions,
    useSyncTermination: true,
    getVerificationTracker,
  })

  const instructionResolver = createInstructionResolver(options.projectDir)
  const instructionSelector = createInstructionSelector(
    Workflow.sync,
    instructionResolver,
    async (ctx) => ctx.iteration === SYNC_FIRST_SESSION,
  )

  return new CommandHandler(
    options,
    options.sandboxMode,
    {
      messagePrefix: 'Sync',
      startupMessage: 'Starting sync mode...',
      allowDestructive: false,
    },
    deps.presenter,
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
  const presenter = new ConsolePresenter({ debug: options.debug })

  const validation = validateRunOptions(options)
  if (!validation.success) {
    presenter.error(validation.error)
    return processExit.exit(1)
  }

  const prereqValidation = validatePrerequisites(validation.options.projectDir)
  if (!prereqValidation.success) {
    presenter.error(prereqValidation.error)
    return processExit.exit(1)
  }

  const deps = await initializeCommonDependencies(
    validation.options.projectDir,
    presenter,
  )
  const handler = createRunHandler(validation.options, deps)

  presenter.start()
  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    presenter.error(`Error: ${err.message}`, err)
    processExit.exit(1)
  } finally {
    presenter.stop()
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
  const presenter = new ConsolePresenter({ debug: options.debug })

  const validation = validateSyncOptions(options)
  if (!validation.success) {
    presenter.error(validation.error)
    return processExit.exit(1)
  }

  const prereqValidation = validatePrerequisites(validation.options.projectDir)
  if (!prereqValidation.success) {
    presenter.error(prereqValidation.error)
    return processExit.exit(1)
  }

  const deps = await initializeCommonDependencies(
    validation.options.projectDir,
    presenter,
  )
  const handler = createSyncHandler(validation.options, deps)

  presenter.start()
  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    presenter.error(`Error: ${err.message}`, err)
    processExit.exit(1)
  } finally {
    presenter.stop()
  }
}
