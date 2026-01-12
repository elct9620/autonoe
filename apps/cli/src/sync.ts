import { validateSyncOptions, type SyncCommandOptions } from './options'
import { SyncCommandHandler } from './syncCommandHandler'
import { ConsoleLogger } from './consoleLogger'
import { VERSION } from './version'

export { VERSION }
export type { SyncCommandOptions }

/**
 * Handle the 'sync' command
 *
 * Entrypoint that:
 * 1. Validates options
 * 2. Initializes dependencies
 * 3. Injects dependencies into Handler
 */
export async function handleSyncCommand(
  options: SyncCommandOptions,
): Promise<void> {
  const logger = new ConsoleLogger({ debug: options.debug })

  // 1. Validate options
  const validation = validateSyncOptions(options)
  if (!validation.success) {
    logger.error(validation.error)
    process.exit(1)
  }

  // 2. Create handler with dependencies
  const handler = new SyncCommandHandler(validation.options, logger)

  // 3. Execute
  try {
    await handler.execute()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error(`Error: ${err.message}`, err)
    process.exit(1)
  }
}
