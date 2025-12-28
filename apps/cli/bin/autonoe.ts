#!/usr/bin/env bun

import cac from 'cac'
import { handleRunCommand, VERSION } from '../src/run.ts'

const cli = cac('autonoe')

cli
  .command('run', 'Run the coding agent')
  .option('-n, --max-iterations <count>', 'Maximum coding sessions', {
    type: [Number],
  })
  .option('-m, --model <model>', 'Claude model to use')
  .option('-d, --debug', 'Show debug output')
  .action(async (options) => {
    await handleRunCommand({
      maxIterations: options.maxIterations,
      model: options.model,
      debug: options.debug,
    })
  })

cli.help()
cli.version(VERSION)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
