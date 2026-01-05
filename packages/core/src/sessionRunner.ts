import type { AgentClientFactory } from './agentClient'
import type { DeliverableStatusReader } from './deliverableStatus'
import type { Logger } from './logger'
import type { InstructionResolver } from './instructions'
import type { Timer } from './timer'
import type { LoopState } from './loopState'
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
import { realTimer } from './timer'
import {
  createInitialLoopState,
  incrementIteration,
  decrementIteration,
  addCost,
  recordError,
  resetErrors,
  setExitReason,
  updateDeliverableCounts,
  buildResult,
} from './loopState'

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
  /** Timer for delay operations (default: realTimer) */
  timer?: Timer
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
  private readonly timer: Timer

  constructor(private options: SessionRunnerOptions) {
    this.delayBetweenSessions = options.delayBetweenSessions ?? 3000
    this.maxIterations = options.maxIterations
    this.maxRetries = options.maxRetries ?? 3
    this.timer = options.timer ?? realTimer
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
    let state = createInitialLoopState()

    // Main loop - use break to exit to unified exit point
    while (!state.exitReason) {
      // Termination condition: User interrupt (SIGINT)
      if (signal?.aborted) {
        logger.info('User interrupted')
        state = setExitReason(state, ExitReason.Interrupted)
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

      state = incrementIteration(state)
      logger.info(`Session ${state.iterations} started`)

      try {
        // Create fresh client per session to avoid SDK child process accumulation
        const client = clientFactory.create()

        const session = new Session({
          projectDir: this.options.projectDir,
          model: this.options.model,
        })

        const result = await session.run(client, instruction, logger)

        // Reset error counter on successful session
        state = resetErrors(state)

        state = addCost(state, result.costUsd)
        logger.info(
          `Session ${state.iterations}: cost=$${result.costUsd.toFixed(4)}, duration=${formatDuration(result.duration)}`,
        )

        // Termination/wait condition: Quota exceeded
        if (result.outcome === SessionOutcome.QuotaExceeded) {
          if (this.options.waitForQuota && result.quotaResetTime) {
            const waitMs = calculateWaitDuration(result.quotaResetTime)
            logger.info(
              `Quota exceeded, waiting ${formatDuration(waitMs)} until reset...`,
            )
            await this.timer.delay(waitMs)
            // Retry same session (don't count this iteration)
            state = decrementIteration(state)
            continue
          } else {
            logger.error('Quota exceeded')
            state = setExitReason(state, ExitReason.QuotaExceeded)
            break
          }
        }

        // Read deliverable status after session
        const status = statusReader
          ? await statusReader.load()
          : emptyDeliverableStatus()

        state = updateDeliverableCounts(
          state,
          countPassedDeliverables(status),
          status.deliverables.length,
          countBlockedDeliverables(status),
        )

        // Termination condition: All achievable deliverables passed
        if (
          statusReader &&
          state.deliverablesTotalCount > 0 &&
          allAchievableDeliverablesPassed(status)
        ) {
          const blockedMsg =
            state.blockedCount > 0 ? ` (${state.blockedCount} blocked)` : ''
          logger.info(`All achievable deliverables passed${blockedMsg}`)
          state = setExitReason(state, ExitReason.AllPassed)
          break
        }

        // Termination condition: All deliverables blocked
        if (
          statusReader &&
          state.deliverablesTotalCount > 0 &&
          allDeliverablesBlocked(status)
        ) {
          logger.info(
            `All ${state.deliverablesTotalCount} deliverables are blocked`,
          )
          state = setExitReason(state, ExitReason.AllBlocked)
          break
        }

        // Termination condition: Max iterations reached
        if (
          this.maxIterations !== undefined &&
          state.iterations >= this.maxIterations
        ) {
          logger.info(`Max iterations (${this.maxIterations}) reached`)
          state = setExitReason(state, ExitReason.MaxIterations)
          break
        }

        // Delay before next session
        if (this.delayBetweenSessions > 0) {
          await this.timer.delay(this.delayBetweenSessions)
        }
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error))
        state = recordError(state, errorObj)

        if (state.consecutiveErrors > this.maxRetries) {
          logger.error(
            `Session failed after ${this.maxRetries} consecutive errors`,
          )
          state = setExitReason(state, ExitReason.MaxRetriesExceeded)
          break
        }

        logger.warn(
          `Session error (${state.consecutiveErrors}/${this.maxRetries}), starting new session...`,
        )
        await this.timer.delay(this.delayBetweenSessions)
      }
    }

    // =============================================
    // Unified exit point - all termination conditions reach here
    // =============================================
    const totalDuration = Date.now() - startTime
    const result = buildResult(state, totalDuration)

    // Log overall summary
    this.logOverall(logger, state, totalDuration)

    return result
  }

  /**
   * Log the overall summary when session runner completes
   * @see SPEC.md Section 3.8.1
   */
  private logOverall(
    logger: Logger,
    state: LoopState,
    totalDuration: number,
  ): void {
    const blockedMsg =
      state.blockedCount > 0 ? ` (${state.blockedCount} blocked)` : ''
    logger.info(
      `Overall: ${state.iterations} session(s), ${state.deliverablesPassedCount}/${state.deliverablesTotalCount} deliverables passed${blockedMsg}, cost=$${state.totalCostUsd.toFixed(4)}, duration=${formatDuration(totalDuration)}`,
    )
  }
}
