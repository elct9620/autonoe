import type { AgentClient } from './agentClient'

/**
 * Session configuration options
 * @see SPEC.md Section 3.3
 */
export interface SessionOptions {
  projectDir: string
  maxIterations?: number
  model?: string
}

/**
 * Result of a session execution
 * @see SPEC.md Section 3.3
 */
export interface SessionResult {
  success: boolean
  scenariosPassedCount: number
  scenariosTotalCount: number
  duration: number
}

/**
 * Session orchestrates the coding agent execution
 * @see SPEC.md Section 3.3
 */
export class Session {
  constructor(private options: SessionOptions) {}

  /**
   * Run the session with an injected AgentClient
   * @see SPEC.md Section 3.6 Dependency Injection
   */
  async run(client: AgentClient): Promise<SessionResult> {
    const startTime = Date.now()

    // Fixed test message for now
    const testMessage = 'Hello, what is 1 + 1?'
    console.log(`Sending: ${testMessage}`)

    const query = client.query(testMessage)

    for await (const message of query) {
      console.log(`Received: ${message.type}`)
    }

    return {
      success: true,
      scenariosPassedCount: 0,
      scenariosTotalCount: 0,
      duration: Date.now() - startTime,
    }
  }
}
