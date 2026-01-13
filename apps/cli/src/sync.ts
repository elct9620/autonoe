import {
  SessionRunner,
  loadConfig,
  DefaultBashSecurity,
  createBashSecurityHook,
  createSyncWriteRestrictionHook,
  type AgentClientFactory,
  type InstructionName,
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
  createRunnerOptions,
} from './factories'
import { SyncInstructionSelector } from './syncInstructionSelector'

export { VERSION }
export type { SyncCommandOptions }

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

  const bashSecurity = new DefaultBashSecurity({
    ...config.bashSecurity,
    mode: 'sync', // Use verification layer for sync command
    allowDestructive: false,
    projectDir: validatedOptions.projectDir,
  })

  const preToolUseHooks = [
    createBashSecurityHook(bashSecurity),
    createSyncWriteRestrictionHook(),
  ]

  // Factory creates MCP server per session with appropriate tool set
  const clientFactory: AgentClientFactory = {
    create: (instructionName: InstructionName) => {
      const { server: deliverableMcpServer, allowedTools: deliverableTools } =
        createDeliverableMcpServer(repository, {
          toolSet: instructionName,
          onStatusChange,
        })

      return new ClaudeAgentClient({
        cwd: validatedOptions.projectDir,
        permissionLevel: 'acceptEdits',
        sandbox: config.sandbox,
        mcpServers: config.mcpServers,
        preToolUseHooks,
        sdkMcpServers: [deliverableMcpServer],
        allowedTools: [...config.allowedTools, ...deliverableTools],
        model: validatedOptions.model,
        maxThinkingTokens: validatedOptions.maxThinkingTokens,
      })
    },
  }

  // Single SessionRunner instance (same pattern as run command)
  // TODO: Remove temporary default once termination conditions are specified
  const syncOptions = {
    ...validatedOptions,
    maxIterations: validatedOptions.maxIterations ?? 15,
  }
  const runnerOptions = createRunnerOptions(syncOptions)
  const sessionRunner = new SessionRunner(runnerOptions)

  // SyncInstructionSelector: session 1 uses 'sync', session 2+ uses 'verify'
  const instructionResolver = createInstructionResolver(
    validatedOptions.projectDir,
  )
  const instructionSelector = new SyncInstructionSelector(instructionResolver)

  const abortController = new AbortController()
  process.on('SIGINT', () => {
    logger.info('')
    logger.info('Received SIGINT, stopping...')
    abortController.abort()
  })

  // 3. Inject dependencies into Handler (same pattern as run command)
  const handler = new SyncCommandHandler(
    validatedOptions,
    logger,
    repository,
    sessionRunner,
    clientFactory,
    instructionSelector,
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
