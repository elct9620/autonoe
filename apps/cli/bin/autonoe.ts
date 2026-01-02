#!/usr/bin/env bun

import cac from 'cac'
import { handleRunCommand, VERSION } from '../src/run.ts'

const cli = cac('autonoe')

cli
  .command('run', 'Run the coding agent')
  .option(
    '-p, --project-dir <path>',
    'Project directory (default: current directory)',
  )
  .option('-n, --max-iterations <count>', 'Maximum coding sessions')
  .option('-m, --model <model>', 'Claude model to use')
  .option('-d, --debug', 'Show debug output')
  .option('--no-sandbox', 'Disable SDK sandbox')
  .option('--wait-for-quota', 'Wait for quota reset instead of exiting')
  .option('-D, --allow-destructive', 'Enable rm/mv with path validation')
  .action(async (options) => {
    await handleRunCommand({
      projectDir: options.projectDir,
      maxIterations: options.maxIterations,
      model: options.model,
      debug: options.debug,
      sandbox: options.sandbox,
      waitForQuota: options.waitForQuota,
      allowDestructive: options.allowDestructive,
    })
  })

cli.help()
cli.version(VERSION)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
