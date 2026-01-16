import type { SessionRunnerResult, Logger } from '@autonoe/core'

export interface ResultHandlerOptions {
  messagePrefix?: string
  onExit?: (code: number) => void
}

export function handleSessionResult(
  result: SessionRunnerResult,
  logger: Logger,
  options: ResultHandlerOptions = {},
): void {
  const prefix = options.messagePrefix ?? 'Session'
  const exit = options.onExit ?? ((code) => process.exit(code))

  switch (result.exitReason) {
    case 'interrupted':
      logger.info(`${prefix} interrupted by user`)
      break
    case 'quota_exceeded':
      logger.error(`${prefix} stopped: quota exceeded`)
      exit(1)
      break
    case 'max_retries_exceeded':
      logger.error(`${prefix} stopped: ${result.error}`)
      exit(1)
      break
    case 'all_passed':
      logger.info(
        prefix === 'Sync'
          ? 'Sync completed: all deliverables verified'
          : 'Session completed successfully',
      )
      break
    case 'all_blocked':
      logger.error('All deliverables blocked')
      exit(1)
      break
    case 'max_iterations':
      logger.info(`${prefix} stopped: max iterations reached`)
      break
  }
}
