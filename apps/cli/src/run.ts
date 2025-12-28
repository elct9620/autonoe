import { runSession, type SessionOptions } from '@autonoe/core'
import { ConsoleLogger } from './consoleLogger'

/**
 * Version constant - should match package.json
 */
export const VERSION = '0.1.0'

/**
 * Options passed from CLI argument parsing
 */
export interface RunCommandOptions {
  maxIterations?: number
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

  const sessionOptions: SessionOptions = {
    projectDir: process.cwd(),
    maxIterations: options.maxIterations,
    model: options.model,
  }

  logger.info(`Autonoe v${VERSION}`)
  logger.info('')
  logger.info('Starting coding agent session...')
  logger.info(`  Working directory: ${sessionOptions.projectDir}`)
  if (sessionOptions.maxIterations) {
    logger.info(`  Max iterations: ${sessionOptions.maxIterations}`)
  }
  if (sessionOptions.model) {
    logger.info(`  Model: ${sessionOptions.model}`)
  }
  logger.info('')

  try {
    const result = await runSession(sessionOptions, logger)

    logger.info('')
    if (result.success) {
      logger.info('Session completed successfully')
    } else {
      logger.info('Session completed with errors')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error:', message)
    process.exit(1)
  }
}
