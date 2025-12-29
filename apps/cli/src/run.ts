import { resolve } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import {
  SessionRunner,
  loadConfig,
  DefaultBashSecurity,
  createBashSecurityHook,
  createAutonoeProtectionHook,
  type SessionRunnerOptions,
} from '@autonoe/core'
import { ClaudeAgentClient } from '@autonoe/claude-agent-client'
import { ConsoleLogger } from './consoleLogger'

/**
 * Version constant - should match package.json
 */
export const VERSION = '0.1.0'

/**
 * Options passed from CLI argument parsing
 */
export interface RunCommandOptions {
  projectDir?: string
  maxIterations?: string
  model?: string
  debug?: boolean
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

  const maxIterations = options.maxIterations
    ? parseInt(options.maxIterations, 10)
    : undefined

  const runnerOptions: SessionRunnerOptions = {
    projectDir,
    maxIterations: Number.isNaN(maxIterations) ? undefined : maxIterations,
    model: options.model,
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
    const bashSecurity = new DefaultBashSecurity()
    const preToolUseHooks = [
      createBashSecurityHook(bashSecurity),
      createAutonoeProtectionHook(),
    ]

    const client = new ClaudeAgentClient({
      cwd: runnerOptions.projectDir,
      permissionLevel: 'default',
      sandbox: config.sandbox,
      mcpServers: config.mcpServers,
      preToolUseHooks,
    })

    const runner = new SessionRunner(runnerOptions)
    const result = await runner.run(client, logger)

    logger.info('')
    if (result.success) {
      logger.info('Session completed successfully')
    } else {
      logger.error('Session completed with errors')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`Error: ${message}`)
    process.exit(1)
  }
}
