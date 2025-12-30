import type { AgentClient } from './agentClient'
import type { Logger } from './logger'
import { silentLogger } from './logger'
import { Session } from './session'

/**
 * SessionRunner configuration options
 * @see SPEC.md Section 3.8.4
 */
export interface SessionRunnerOptions {
  projectDir: string
  maxIterations?: number
  delayBetweenSessions?: number
  model?: string
}

/**
 * Result of a SessionRunner execution
 * @see SPEC.md Section 3.8.4
 */
export interface SessionRunnerResult {
  success: boolean
  iterations: number
  deliverablesPassedCount: number
  deliverablesTotalCount: number
  totalDuration: number
}

/**
 * SessionRunner orchestrates multiple Session executions in a loop
 * @see SPEC.md Section 3.8
 */
export class SessionRunner {
  private readonly delayBetweenSessions: number

  constructor(private options: SessionRunnerOptions) {
    this.delayBetweenSessions = options.delayBetweenSessions ?? 3000
  }

  /**
   * Run the session loop with an injected AgentClient and Logger
   * @see SPEC.md Section 3.8.4
   */
  async run(
    client: AgentClient,
    logger: Logger = silentLogger,
  ): Promise<SessionRunnerResult> {
    const startTime = Date.now()
    let iterations = 0
    let deliverablesPassedCount = 0
    let deliverablesTotalCount = 0

    const session = new Session({
      projectDir: this.options.projectDir,
      model: this.options.model,
    })

    // For now, run single iteration
    // TODO: Implement loop with instruction selection
    iterations = 1
    logger.info(`Session ${iterations} started`)

    const instruction = 'Hello, what is 1 + 1?' // Placeholder
    const result = await session.run(client, instruction, logger)

    deliverablesPassedCount = result.deliverablesPassedCount
    deliverablesTotalCount = result.deliverablesTotalCount

    logger.info(
      `Session ${iterations}: cost=$${result.costUsd.toFixed(4)}, duration=${result.duration}ms`,
    )

    return {
      success: true,
      iterations,
      deliverablesPassedCount,
      deliverablesTotalCount,
      totalDuration: Date.now() - startTime,
    }
  }
}
