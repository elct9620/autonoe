#!/usr/bin/env bun

import cac from 'cac'
import { handleRunCommand, handleSyncCommand, VERSION } from '../src/index.ts'

const cli = cac('autonoe')

cli
  .command('run', 'Run the coding agent')
  .option(
    '-p, --project-dir <path>',
    'Project directory (default: current directory)',
  )
  .option('-n, --max-iterations <count>', 'Maximum coding sessions')
  .option(
    '--max-retries <count>',
    'Maximum retries on session error (default: 3)',
  )
  .option('-m, --model <model>', 'Claude model to use')
  .option('-d, --debug', 'Show debug output')
  .option('--no-sandbox', 'Disable SDK sandbox')
  .option('--wait-for-quota', 'Wait for quota reset instead of exiting')
  .option('-D, --allow-destructive', 'Enable rm/mv with path validation')
  .option(
    '--thinking [budget]',
    'Enable extended thinking mode (default: 8192)',
  )
  .action(async (options) => {
    await handleRunCommand({
      projectDir: options.projectDir,
      maxIterations: options.maxIterations,
      maxRetries: options.maxRetries,
      model: options.model,
      debug: options.debug,
      sandbox: options.sandbox,
      waitForQuota: options.waitForQuota,
      allowDestructive: options.allowDestructive,
      thinking: options.thinking,
    })
  })

cli
  .command('sync', 'Sync deliverables from SPEC.md')
  .option(
    '-p, --project-dir <path>',
    'Project directory (default: current directory)',
  )
  .option('-n, --max-iterations <count>', 'Maximum coding sessions')
  .option(
    '--max-retries <count>',
    'Maximum retries on session error (default: 3)',
  )
  .option('-m, --model <model>', 'Claude model to use')
  .option('-d, --debug', 'Show debug output')
  .option('--wait-for-quota', 'Wait for quota reset instead of exiting')
  .option(
    '--thinking [budget]',
    'Enable extended thinking mode (default: 8192)',
  )
  .action(async (options) => {
    await handleSyncCommand({
      projectDir: options.projectDir,
      maxIterations: options.maxIterations,
      maxRetries: options.maxRetries,
      model: options.model,
      debug: options.debug,
      waitForQuota: options.waitForQuota,
      thinking: options.thinking,
    })
  })

cli.help()
cli.version(VERSION)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
