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

// Session exports
export { Session, type SessionOptions, type SessionResult } from './session'

import { ClaudeAgentClient } from './agentClient'
import { Session, type SessionOptions, type SessionResult } from './session'

/**
 * Convenience function to run a coding agent session
 * Creates default ClaudeAgentClient and runs the session
 *
 * @param options - Session configuration
 * @returns Session execution result
 */
export async function runSession(
  options: SessionOptions,
): Promise<SessionResult> {
  const client = new ClaudeAgentClient({
    cwd: options.projectDir,
    permissionMode: 'default',
  })

  const session = new Session(options)
  return session.run(client)
}
