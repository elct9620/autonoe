#!/usr/bin/env bun

import cac from 'cac'
import { handleRunCommand } from '../src/run.ts'

const VERSION = '0.1.0'

const cli = cac('autonoe')

cli
  .command('run', 'Run the coding agent')
  .option('-n, --max-iterations <count>', 'Maximum coding sessions', {
    type: [Number],
  })
  .option('-m, --model <model>', 'Claude model to use')
  .action(async (options) => {
    console.log(`Autonoe v${VERSION}`)
    console.log('')
    await handleRunCommand({
      maxIterations: options.maxIterations,
      model: options.model,
    })
  })

cli.help()
cli.version(VERSION)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
