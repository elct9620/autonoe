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
 * Exit reason for session runner loop
 * @see SPEC.md Section 3.10
 */
export enum ExitReason {
  AllPassed = 'all_passed',
  AllBlocked = 'all_blocked',
  MaxIterations = 'max_iterations',
  QuotaExceeded = 'quota_exceeded',
  Interrupted = 'interrupted',
  MaxRetriesExceeded = 'max_retries_exceeded',
}

/**
 * SessionRunner configuration options
 * @see SPEC.md Section 3.9.4
 */
export interface SessionRunnerOptions {
  projectDir: string
  maxIterations?: number
  delayBetweenSessions?: number
  model?: string
  waitForQuota?: boolean
  maxThinkingTokens?: number
  maxRetries?: number
}

/**
 * Result of a SessionRunner execution
 * @see SPEC.md Section 3.9.4
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
  error?: string
}

/**
 * SessionRunner orchestrates multiple Session executions in a loop
 * @see SPEC.md Section 3.9
 */
export class SessionRunner {
  private readonly delayBetweenSessions: number
  private readonly maxIterations: number | undefined
  private readonly maxRetries: number

  constructor(private options: SessionRunnerOptions) {
    this.delayBetweenSessions = options.delayBetweenSessions ?? 3000
    this.maxIterations = options.maxIterations
    this.maxRetries = options.maxRetries ?? 3
  }

  /**
   * Run the session loop with an injected AgentClientFactory and Logger
   * Loop continues until all deliverables pass or max iterations reached
   * @see SPEC.md Section 3.9.3, 3.9.4, 3.10
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
    let consecutiveErrors = 0
    let lastError: Error | undefined
    let exitReason: ExitReason | undefined

    // Main loop - use break to exit to unified exit point
    while (!exitReason) {
      // Termination condition: User interrupt (SIGINT)
      if (signal?.aborted) {
        logger.info('User interrupted')
        exitReason = ExitReason.Interrupted
        break
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

      try {
        // Create fresh client per session to avoid SDK child process accumulation
        const client = clientFactory.create()

        const session = new Session({
          projectDir: this.options.projectDir,
          model: this.options.model,
        })

        const result = await session.run(client, instruction, logger)

        // Reset error counter on successful session
        consecutiveErrors = 0

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
            exitReason = ExitReason.QuotaExceeded
            break
          }
        }

        // Read deliverable status after session
        const status = statusReader
          ? await statusReader.load()
          : emptyDeliverableStatus()

        deliverablesPassedCount = countPassedDeliverables(status)
        deliverablesTotalCount = status.deliverables.length
        blockedCount = countBlockedDeliverables(status)

        // Termination condition: All achievable deliverables passed
        if (
          statusReader &&
          deliverablesTotalCount > 0 &&
          allAchievableDeliverablesPassed(status)
        ) {
          const blockedMsg =
            blockedCount > 0 ? ` (${blockedCount} blocked)` : ''
          logger.info(`All achievable deliverables passed${blockedMsg}`)
          exitReason = ExitReason.AllPassed
          break
        }

        // Termination condition: All deliverables blocked
        if (
          statusReader &&
          deliverablesTotalCount > 0 &&
          allDeliverablesBlocked(status)
        ) {
          logger.info(`All ${deliverablesTotalCount} deliverables are blocked`)
          exitReason = ExitReason.AllBlocked
          break
        }

        // Termination condition: Max iterations reached
        if (
          this.maxIterations !== undefined &&
          iterations >= this.maxIterations
        ) {
          logger.info(`Max iterations (${this.maxIterations}) reached`)
          exitReason = ExitReason.MaxIterations
          break
        }

        // Delay before next session
        if (this.delayBetweenSessions > 0) {
          await this.delay(this.delayBetweenSessions)
        }
      } catch (error) {
        consecutiveErrors++
        lastError = error instanceof Error ? error : new Error(String(error))

        if (consecutiveErrors > this.maxRetries) {
          logger.error(
            `Session failed after ${this.maxRetries} consecutive errors`,
          )
          exitReason = ExitReason.MaxRetriesExceeded
          break
        }

        logger.warn(
          `Session error (${consecutiveErrors}/${this.maxRetries}), starting new session...`,
        )
        await this.delay(this.delayBetweenSessions)
      }
    }

    // =============================================
    // Unified exit point - all termination conditions reach here
    // =============================================
    const totalDuration = Date.now() - startTime

    // Build result based on exitReason
    const success = exitReason === ExitReason.AllPassed
    const result: SessionRunnerResult = {
      success,
      iterations,
      deliverablesPassedCount,
      deliverablesTotalCount,
      blockedCount,
      totalDuration,
      totalCostUsd,
      interrupted: exitReason === ExitReason.Interrupted,
      quotaExceeded: exitReason === ExitReason.QuotaExceeded,
      error:
        exitReason === ExitReason.MaxRetriesExceeded
          ? lastError?.message
          : undefined,
    }

    // Single logOverall call
    this.logOverall(
      logger,
      iterations,
      deliverablesPassedCount,
      deliverablesTotalCount,
      blockedCount,
      totalCostUsd,
      totalDuration,
    )

    return result
  }

  /**
   * Log the overall summary when session runner completes
   * @see SPEC.md Section 3.8.1
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
