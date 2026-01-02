import type { AgentClientFactory } from './agentClient'
import type { DeliverableStatusReader } from './deliverableStatus'
import type { Logger } from './logger'
import type { InstructionResolver } from './instructions'
import { silentLogger } from './logger'
import { Session } from './session'
import {
  allAchievableDeliverablesPassed,
  allDeliverablesBlocked,
  countPassedDeliverables,
  countBlockedDeliverables,
  emptyDeliverableStatus,
} from './deliverableStatus'
import { initializerInstruction, codingInstruction } from './instructions'
import { SessionOutcome } from './types'
import { calculateWaitDuration } from './quotaLimit'
import { formatDuration } from './duration'

/**
 * SessionRunner configuration options
 * @see SPEC.md Section 3.8.4
 */
export interface SessionRunnerOptions {
  projectDir: string
  maxIterations?: number
  delayBetweenSessions?: number
  model?: string
  waitForQuota?: boolean
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
  blockedCount: number
  totalDuration: number
  totalCostUsd: number
  interrupted?: boolean
  quotaExceeded?: boolean
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
    instructionResolver?: InstructionResolver,
    signal?: AbortSignal,
  ): Promise<SessionRunnerResult> {
    const startTime = Date.now()
    let iterations = 0
    let deliverablesPassedCount = 0
    let deliverablesTotalCount = 0
    let blockedCount = 0
    let totalCostUsd = 0

    while (true) {
      // Termination condition 0: User interrupt (SIGINT)
      if (signal?.aborted) {
        logger.info('User interrupted')
        const totalDuration = Date.now() - startTime
        this.logOverall(
          logger,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalCostUsd,
          totalDuration,
        )
        return {
          success: false,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalDuration,
          totalCostUsd,
          interrupted: true,
        }
      }
      // Select instruction based on status existence
      // @see SPEC.md Section 7.2
      const statusExists = statusReader ? await statusReader.exists() : false
      const instructionName = statusExists ? 'coding' : 'initializer'
      const instruction = instructionResolver
        ? await instructionResolver.resolve(instructionName)
        : statusExists
          ? codingInstruction
          : initializerInstruction

      iterations++
      logger.info(`Session ${iterations} started`)

      // Create fresh client per session to avoid SDK child process accumulation
      const client = clientFactory.create()

      const session = new Session({
        projectDir: this.options.projectDir,
        model: this.options.model,
      })

      const result = await session.run(client, instruction, logger)

      totalCostUsd += result.costUsd
      logger.info(
        `Session ${iterations}: cost=$${result.costUsd.toFixed(4)}, duration=${formatDuration(result.duration)}`,
      )

      // Termination/wait condition: Quota exceeded
      if (result.outcome === SessionOutcome.QuotaExceeded) {
        if (this.options.waitForQuota && result.quotaResetTime) {
          const waitMs = calculateWaitDuration(result.quotaResetTime)
          logger.info(
            `Quota exceeded, waiting ${formatDuration(waitMs)} until reset...`,
          )
          await this.delay(waitMs)
          // Retry same session (don't count this iteration)
          iterations--
          continue
        } else {
          logger.error('Quota exceeded')
          const totalDuration = Date.now() - startTime
          this.logOverall(
            logger,
            iterations,
            deliverablesPassedCount,
            deliverablesTotalCount,
            blockedCount,
            totalCostUsd,
            totalDuration,
          )
          return {
            success: false,
            iterations,
            deliverablesPassedCount,
            deliverablesTotalCount,
            blockedCount,
            totalDuration,
            totalCostUsd,
            quotaExceeded: true,
          }
        }
      }

      // Read deliverable status after session
      const status = statusReader
        ? await statusReader.load()
        : emptyDeliverableStatus()

      deliverablesPassedCount = countPassedDeliverables(status)
      deliverablesTotalCount = status.deliverables.length
      blockedCount = countBlockedDeliverables(status)

      // Termination condition 1: All achievable deliverables passed
      if (
        statusReader &&
        deliverablesTotalCount > 0 &&
        allAchievableDeliverablesPassed(status)
      ) {
        const blockedMsg = blockedCount > 0 ? ` (${blockedCount} blocked)` : ''
        logger.info(`All achievable deliverables passed${blockedMsg}`)
        const totalDuration = Date.now() - startTime
        this.logOverall(
          logger,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalCostUsd,
          totalDuration,
        )
        return {
          success: true,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalDuration,
          totalCostUsd,
        }
      }

      // Termination condition 2: All deliverables blocked
      if (
        statusReader &&
        deliverablesTotalCount > 0 &&
        allDeliverablesBlocked(status)
      ) {
        logger.info(`All ${deliverablesTotalCount} deliverables are blocked`)
        const totalDuration = Date.now() - startTime
        this.logOverall(
          logger,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalCostUsd,
          totalDuration,
        )
        return {
          success: false,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalDuration,
          totalCostUsd,
        }
      }

      // Termination condition 3: Max iterations reached
      if (
        this.maxIterations !== undefined &&
        iterations >= this.maxIterations
      ) {
        logger.info(`Max iterations (${this.maxIterations}) reached`)
        const totalDuration = Date.now() - startTime
        this.logOverall(
          logger,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalCostUsd,
          totalDuration,
        )
        return {
          success: false,
          iterations,
          deliverablesPassedCount,
          deliverablesTotalCount,
          blockedCount,
          totalDuration,
          totalCostUsd,
        }
      }

      // Delay before next session
      if (this.delayBetweenSessions > 0) {
        await this.delay(this.delayBetweenSessions)
      }
    }
  }

  /**
   * Log the overall summary when session runner completes
   * @see SPEC.md Section 3.7.1
   */
  private logOverall(
    logger: Logger,
    iterations: number,
    passedCount: number,
    totalCount: number,
    blockedCount: number,
    totalCostUsd: number,
    totalDuration: number,
  ): void {
    const blockedMsg = blockedCount > 0 ? ` (${blockedCount} blocked)` : ''
    logger.info(
      `Overall: ${iterations} session(s), ${passedCount}/${totalCount} deliverables passed${blockedMsg}, cost=$${totalCostUsd.toFixed(4)}, duration=${formatDuration(totalDuration)}`,
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
