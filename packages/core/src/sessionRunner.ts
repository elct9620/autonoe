import type { AgentClientFactory } from './agentClient'
import type { DeliverableStatusReader } from './deliverableStatus'
import type { Logger } from './logger'
import { silentLogger } from './logger'
import { Session } from './session'
import {
  allDeliverablesPassed,
  countPassedDeliverables,
  emptyDeliverableStatus,
} from './deliverableStatus'

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
  private readonly maxIterations: number | undefined

  constructor(private options: SessionRunnerOptions) {
    this.delayBetweenSessions = options.delayBetweenSessions ?? 3000
    this.maxIterations = options.maxIterations
  }

  /**
   * Run the session loop with an injected AgentClientFactory and Logger
   * Loop continues until all deliverables pass or max iterations reached
   * @see SPEC.md Section 3.8.3, 3.8.4, 3.9
   */
  async run(
    clientFactory: AgentClientFactory,
    logger: Logger = silentLogger,
    statusReader?: DeliverableStatusReader,
  ): Promise<SessionRunnerResult> {
    const startTime = Date.now()
    let iterations = 0
    let deliverablesPassedCount = 0
    let deliverablesTotalCount = 0

    // Fixed test instruction (instruction selection not in scope)
    const instruction =
      'Process the next deliverable. Create deliverables if none exist, then verify and mark them as passed.'

    while (true) {
      iterations++
      logger.info(`Session ${iterations} started`)

      // Create fresh client per session to avoid SDK child process accumulation
      const client = clientFactory.create()

      const session = new Session({
        projectDir: this.options.projectDir,
        model: this.options.model,
      })

      const result = await session.run(client, instruction, logger)

      logger.info(
        `Session ${iterations}: cost=$${result.costUsd.toFixed(4)}, duration=${result.duration}ms`,
      )

      // Read deliverable status after session
      const status = statusReader
        ? await statusReader.load()
        : emptyDeliverableStatus()

      deliverablesPassedCount = countPassedDeliverables(status)
      deliverablesTotalCount = status.deliverables.length

      // Termination condition 1: All deliverables passed
      if (
        statusReader &&
        deliverablesTotalCount > 0 &&
        allDeliverablesPassed(status)
      ) {
        logger.info(`All ${deliverablesTotalCount} deliverables passed`)
        return {
          success: true,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          totalDuration: Date.now() - startTime,
        }
      }

      // Termination condition 2: Max iterations reached
      if (this.maxIterations !== undefined && iterations >= this.maxIterations) {
        logger.info(`Max iterations (${this.maxIterations}) reached`)
        return {
          success: false,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          totalDuration: Date.now() - startTime,
        }
      }

      // Delay before next session
      if (this.delayBetweenSessions > 0) {
        await this.delay(this.delayBetweenSessions)
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
