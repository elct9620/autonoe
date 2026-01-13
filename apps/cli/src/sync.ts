import {
  SessionRunner,
  loadConfig,
  DefaultBashSecurity,
  createBashSecurityHook,
  createSyncWriteRestrictionHook,
  type AgentClientFactory,
  type SessionRunnerOptions,
  type DeliverableStatusCallback,
  type AgentConfig,
} from '@autonoe/core'
import {
  ClaudeAgentClient,
  FileDeliverableRepository,
  createDeliverableMcpServer,
} from '@autonoe/agent'
import {
  validateSyncOptions,
  type SyncCommandOptions,
  type ValidatedSyncOptions,
} from './options'
import { SyncCommandHandler } from './syncCommandHandler'
import { ConsoleLogger } from './consoleLogger'
import { VERSION } from './version'
import {
  createInstructionResolver,
  createStatusChangeCallback,
} from './factories'
import { ConsoleWaitProgressReporter } from './consoleWaitProgressReporter'

export { VERSION }
export type { SyncCommandOptions }

/**
 * Sync phase type for tool set selection
 */
export type SyncPhase = 'sync' | 'verify'

/**
 * Create a client factory for a specific sync phase
 *
 * Each phase uses different tool sets:
 * - sync: create_deliverable, deprecate_deliverable
 * - verify: set_deliverable_status
 *
 * @see SPEC.md Section 8.3
 */
function createSyncPhaseClientFactory(
  phase: SyncPhase,
  options: ValidatedSyncOptions,
  config: AgentConfig,
  repository: FileDeliverableRepository,
  onStatusChange?: DeliverableStatusCallback,
): AgentClientFactory {
  const { server, allowedTools } = createDeliverableMcpServer(repository, {
    toolSet: phase,
    onStatusChange,
  })

  const bashSecurity = new DefaultBashSecurity({
    ...config.bashSecurity,
    mode: 'sync', // Use verification layer for sync command
    allowDestructive: false,
    projectDir: options.projectDir,
  })

  const preToolUseHooks = [
    createBashSecurityHook(bashSecurity),
    createSyncWriteRestrictionHook(),
  ]

  return {
    create: () =>
      new ClaudeAgentClient({
        cwd: options.projectDir,
        permissionLevel: 'acceptEdits',
        sandbox: config.sandbox,
        mcpServers: config.mcpServers,
        preToolUseHooks,
        sdkMcpServers: [server],
        allowedTools: [...config.allowedTools, ...allowedTools],
        model: options.model,
        maxThinkingTokens: options.maxThinkingTokens,
      }),
  }
}

/**
 * Create SessionRunnerOptions from validated sync options
 */
function createSyncRunnerOptions(
  options: ValidatedSyncOptions,
): SessionRunnerOptions {
  return {
    projectDir: options.projectDir,
    maxIterations: options.maxIterations,
    maxRetries: options.maxRetries,
    model: options.model,
    waitForQuota: options.waitForQuota,
    maxThinkingTokens: options.maxThinkingTokens,
    waitProgressReporter: options.waitForQuota
      ? new ConsoleWaitProgressReporter()
      : undefined,
  }
}

/**
 * Handle the 'sync' command
 *
 * Entrypoint that:
 * 1. Validates options
 * 2. Initializes all dependencies
 * 3. Injects dependencies into Handler
 */
export async function handleSyncCommand(
  options: SyncCommandOptions,
): Promise<void> {
  const logger = new ConsoleLogger({ debug: options.debug })

  // 1. Validate options
  const validation = validateSyncOptions(options)
  if (!validation.success) {
    logger.error(validation.error)
    process.exit(1)
  }
  const validatedOptions = validation.options

  // 2. Initialize all dependencies
  const config = await loadConfig(validatedOptions.projectDir)
  const repository = new FileDeliverableRepository(validatedOptions.projectDir)
  const onStatusChange = createStatusChangeCallback(logger)

  // Create a factory function that returns phase-specific client factories
  const createClientFactory = (phase: SyncPhase): AgentClientFactory =>
    createSyncPhaseClientFactory(
      phase,
      validatedOptions,
      config,
      repository,
      onStatusChange,
    )

  // Create a factory function for SessionRunner
  const runnerOptions = createSyncRunnerOptions(validatedOptions)
  const createSessionRunner = () => new SessionRunner(runnerOptions)

  const instructionResolver = createInstructionResolver(
    validatedOptions.projectDir,
  )

  const abortController = new AbortController()
  process.on('SIGINT', () => {
    logger.info('')
    logger.info('Received SIGINT, stopping...')
    abortController.abort()
  })

  // 3. Inject dependencies into Handler
  const handler = new SyncCommandHandler(
    validatedOptions,
    logger,
    repository,
    instructionResolver,
    createClientFactory,
    createSessionRunner,
    abortController.signal,
  )

  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(`Error: ${err.message}`, err)
    process.exit(1)
  }
}
