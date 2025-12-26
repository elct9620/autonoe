import {
  runSession,
  type SessionOptions,
  type SessionResult,
} from '@autonoe/core'

/**
 * Options passed from CLI argument parsing
 */
export interface RunCommandOptions {
  maxIterations?: number
  model?: string
}

/**
 * Handle the 'run' command
 *
 * @param options - Parsed CLI options
 */
export async function handleRunCommand(
  options: RunCommandOptions,
): Promise<void> {
  const sessionOptions: SessionOptions = {
    projectDir: process.cwd(),
    maxIterations: options.maxIterations,
    model: options.model,
  }

  console.log('Starting coding agent session...')
  console.log(`  Working directory: ${sessionOptions.projectDir}`)
  if (sessionOptions.maxIterations) {
    console.log(`  Max iterations: ${sessionOptions.maxIterations}`)
  }
  if (sessionOptions.model) {
    console.log(`  Model: ${sessionOptions.model}`)
  }
  console.log('')

  const result: SessionResult = await runSession(sessionOptions)

  console.log('')
  if (result.success) {
    console.log('Session completed successfully')
  } else {
    console.log('Session completed with errors')
  }
}
