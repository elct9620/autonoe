import { resolve, join } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import {
  SessionRunner,
  loadConfig,
  DefaultBashSecurity,
  createBashSecurityHook,
  createAutonoeProtectionHook,
  initializerInstruction,
  codingInstruction,
  type SessionRunnerOptions,
  type AgentClientFactory,
  type InstructionResolver,
  type InstructionName,
  type DeliverableStatusCallback,
} from '@autonoe/core'
import {
  ClaudeAgentClient,
  FileDeliverableRepository,
  createDeliverableMcpServer,
} from '@autonoe/agent'
import { ConsoleLogger } from './consoleLogger'

/**
 * Version constant - should match package.json
 */
export const VERSION = '0.1.0' // x-release-please-version

/**
 * Create an instruction resolver with override support
 * Checks for .autonoe/{name}.md override files before falling back to defaults
 * @see SPEC.md Section A.4
 */
function createInstructionResolver(projectDir: string): InstructionResolver {
  return {
    async resolve(name: InstructionName): Promise<string> {
      const overridePath = join(projectDir, '.autonoe', `${name}.md`)

      try {
        // Try to read override file
        return await readFile(overridePath, 'utf-8')
      } catch {
        // Fallback to default instruction
        return name === 'initializer'
          ? initializerInstruction
          : codingInstruction
      }
    },
  }
}

/**
 * Options passed from CLI argument parsing
 */
export interface RunCommandOptions {
  projectDir?: string
  maxIterations?: string
  model?: string
  debug?: boolean
  sandbox?: boolean
  waitForQuota?: boolean
  allowDestructive?: boolean
}

/**
 * Handle the 'run' command
 *
 * @param options - Parsed CLI options
 */
export async function handleRunCommand(
  options: RunCommandOptions,
): Promise<void> {
  const logger = new ConsoleLogger({ debug: options.debug })

  // Resolve project directory
  const projectDir = options.projectDir
    ? resolve(options.projectDir)
    : process.cwd()

  // Validate project directory exists
  if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
    logger.error(`Project directory does not exist: ${projectDir}`)
    process.exit(1)
  }

  // Warning: --no-sandbox (SPEC.md Section 6.4.6)
  if (options.sandbox === false) {
    console.error(
      'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
    )
  }

  // Warning: --allow-destructive (SPEC.md Section 6.4.6)
  if (options.allowDestructive) {
    console.error(
      'Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.',
    )
  }

  const maxIterations = options.maxIterations
    ? parseInt(options.maxIterations, 10)
    : undefined

  const runnerOptions: SessionRunnerOptions = {
    projectDir,
    maxIterations: Number.isNaN(maxIterations) ? undefined : maxIterations,
    model: options.model,
    waitForQuota: options.waitForQuota,
  }

  logger.info(`Autonoe v${VERSION}`)
  logger.info('')
  logger.info('Starting coding agent session...')
  logger.info(`  Working directory: ${runnerOptions.projectDir}`)
  if (runnerOptions.maxIterations) {
    logger.info(`  Max iterations: ${runnerOptions.maxIterations}`)
  }
  if (runnerOptions.model) {
    logger.info(`  Model: ${runnerOptions.model}`)
  }
  logger.info('')

  try {
    // Load configuration (merges hardcoded + user agent.json)
    const config = await loadConfig(runnerOptions.projectDir)

    // Create security hooks
    const bashSecurity = new DefaultBashSecurity({
      ...config.bashSecurity,
      allowDestructive: options.allowDestructive,
      projectDir: runnerOptions.projectDir,
    })
    const preToolUseHooks = [
      createBashSecurityHook(bashSecurity),
      createAutonoeProtectionHook(),
    ]

    // Create deliverable tools (for tracking work units)
    const deliverableRepo = new FileDeliverableRepository(
      runnerOptions.projectDir,
    )

    // Callback to display deliverable status changes
    const onStatusChange: DeliverableStatusCallback = (notification) => {
      const icon =
        notification.newStatus === 'passed'
          ? '[PASS]'
          : notification.newStatus === 'blocked'
            ? '[BLOCKED]'
            : '[PENDING]'
      logger.info(
        `${icon} ${notification.deliverableName} (${notification.deliverableId})`,
      )
    }

    const deliverableMcpServer = createDeliverableMcpServer(
      deliverableRepo,
      onStatusChange,
    )

    // Deliverable MCP tool names
    const deliverableTools = [
      'mcp__autonoe-deliverable__create_deliverable',
      'mcp__autonoe-deliverable__set_deliverable_status',
    ]

    // Create factory for fresh client per session
    const clientFactory: AgentClientFactory = {
      create: () =>
        new ClaudeAgentClient({
          cwd: runnerOptions.projectDir,
          permissionLevel: 'acceptEdits',
          sandbox: options.sandbox !== false ? config.sandbox : undefined,
          mcpServers: config.mcpServers,
          preToolUseHooks,
          sdkMcpServers: [deliverableMcpServer],
          allowedTools: [...config.allowedTools, ...deliverableTools],
        }),
    }

    // Create instruction resolver with override support
    const instructionResolver = createInstructionResolver(
      runnerOptions.projectDir,
    )

    // Setup SIGINT handler for graceful shutdown
    const abortController = new AbortController()
    process.on('SIGINT', () => {
      logger.info('')
      logger.info('Received SIGINT, stopping...')
      abortController.abort()
    })

    const runner = new SessionRunner(runnerOptions)
    const result = await runner.run(
      clientFactory,
      logger,
      deliverableRepo,
      instructionResolver,
      abortController.signal,
    )

    logger.info('')
    if (result.interrupted) {
      logger.info('Session interrupted by user')
    } else if (result.quotaExceeded) {
      logger.error('Session stopped: quota exceeded')
      process.exit(1)
    } else if (result.success) {
      logger.info('Session completed successfully')
    } else {
      logger.error('Session completed with errors')
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(`Error: ${err.message}`, err)
    process.exit(1)
  }
}
