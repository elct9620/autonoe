// AgentClient exports
export type {
  AgentClient,
  Query,
  QueryOptions,
  SDKMessage,
  McpServerConfig,
  PermissionMode,
} from './agentClient'
export { ClaudeAgentClient } from './agentClient'

// Logger exports
export type { Logger, LogLevel } from './logger'
export { silentLogger } from './logger'

// Session exports
export { Session, type SessionOptions, type SessionResult } from './session'

import { ClaudeAgentClient } from './agentClient'
import { Session, type SessionOptions, type SessionResult } from './session'
import { silentLogger, type Logger } from './logger'

/**
 * Convenience function to run a coding agent session
 * Creates default ClaudeAgentClient and runs the session
 *
 * @param options - Session configuration
 * @param logger - Logger for output (defaults to silentLogger)
 * @returns Session execution result
 */
export async function runSession(
  options: SessionOptions,
  logger: Logger = silentLogger,
): Promise<SessionResult> {
  const client = new ClaudeAgentClient({
    cwd: options.projectDir,
    permissionMode: 'default',
  })

  const session = new Session(options)
  return session.run(client, logger)
}
