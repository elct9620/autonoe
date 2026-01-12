import {
  SessionRunner,
  loadConfig,
  DefaultBashSecurity,
  createBashSecurityHook,
  createAutonoeProtectionHook,
  type AgentClientFactory,
} from '@autonoe/core'
import {
  ClaudeAgentClient,
  FileDeliverableRepository,
  createDeliverableMcpServer,
} from '@autonoe/agent'
import { validateRunOptions, type RunCommandOptions } from './options'
import { RunCommandHandler, VERSION } from './runCommandHandler'
import { ConsoleLogger } from './consoleLogger'
import {
  createInstructionResolver,
  createStatusChangeCallback,
  createRunnerOptions,
} from './factories'

// Re-export for backward compatibility
export { VERSION }
export type { RunCommandOptions }

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
): Promise<void> {
  const logger = new ConsoleLogger({ debug: options.debug })

  // 1. Validate options
  const validation = validateRunOptions(options)
  if (!validation.success) {
    logger.error(validation.error)
    process.exit(1)
  }
  const validatedOptions = validation.options

  // 2. Initialize all dependencies
  const config = await loadConfig(validatedOptions.projectDir)

  const repository = new FileDeliverableRepository(validatedOptions.projectDir)

  const onStatusChange = createStatusChangeCallback(logger)

  const { server: deliverableMcpServer, allowedTools: deliverableTools } =
    createDeliverableMcpServer(repository, {
      toolSet: 'run',
      onStatusChange,
    })

  const bashSecurity = new DefaultBashSecurity({
    ...config.bashSecurity,
    mode: 'run',
    allowDestructive: validatedOptions.allowDestructive,
    projectDir: validatedOptions.projectDir,
  })
  const preToolUseHooks = [
    createBashSecurityHook(bashSecurity),
    createAutonoeProtectionHook(),
  ]

  const clientFactory: AgentClientFactory = {
    create: () =>
      new ClaudeAgentClient({
        cwd: validatedOptions.projectDir,
        permissionLevel: 'acceptEdits',
        sandbox: validatedOptions.sandboxMode.disabled
          ? undefined
          : config.sandbox,
        mcpServers: config.mcpServers,
        preToolUseHooks,
        sdkMcpServers: [deliverableMcpServer],
        allowedTools: [...config.allowedTools, ...deliverableTools],
        model: validatedOptions.model,
        maxThinkingTokens: validatedOptions.maxThinkingTokens,
      }),
  }

  const runnerOptions = createRunnerOptions(validatedOptions)
  const sessionRunner = new SessionRunner(runnerOptions)

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
  const handler = new RunCommandHandler(
    validatedOptions,
    logger,
    repository,
    sessionRunner,
    clientFactory,
    instructionResolver,
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
