import type { AgentClientFactory } from './agentClient'
import {
  DeliverableStatus,
  type DeliverableStatusReader,
} from './deliverableStatus'
import type { Logger } from './logger'
import type { InstructionResolver } from './instructions'
import type { Timer } from './timer'
import type { TerminationContext } from './terminationEvaluator'
import { silentLogger } from './logger'
import { Session } from './session'
import {
  selectInstruction,
  createDefaultInstructionResolver,
} from './instructions'
import { nullDeliverableStatusReader } from './deliverableStatus'
import type { SessionOutcome } from './types'
import { formatDuration } from './duration'
import { realTimer } from './timer'
import { LoopState } from './loopState'
import { evaluateTermination } from './terminationEvaluator'

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
 * Build SessionRunnerResult from LoopState
 * Separated from LoopState to avoid bidirectional dependency
 */
function buildResult(
  state: LoopState,
  totalDuration: number,
): SessionRunnerResult {
  return {
    success: state.exitReason === ExitReason.AllPassed,
    iterations: state.iterations,
    deliverablesPassedCount: state.deliverablesPassedCount,
    deliverablesTotalCount: state.deliverablesTotalCount,
    blockedCount: state.blockedCount,
    totalDuration,
    totalCostUsd: state.totalCostUsd,
    interrupted: state.exitReason === ExitReason.Interrupted,
    quotaExceeded: state.exitReason === ExitReason.QuotaExceeded,
    error:
      state.exitReason === ExitReason.MaxRetriesExceeded
        ? state.lastError?.message
        : undefined,
  }
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
    let state = LoopState.create()

    // Main loop - use break to exit to unified exit point
    while (!state.exitReason) {
      // Pre-session: check interrupt
      const preDecision = this.runTerminationEvaluation(state, { signal })
      if (preDecision.shouldTerminate && preDecision.exitReason) {
        this.logTermination(logger, preDecision.exitReason, state)
        state = state.setExitReason(preDecision.exitReason)
        break
      }

      // Select instruction based on status existence
      // @see SPEC.md Section 7.2
      const instruction = await selectInstruction(
        statusReader ?? nullDeliverableStatusReader,
        instructionResolver ?? createDefaultInstructionResolver(),
      )

      state = state.incrementIterations()
      logger.info(`Session ${state.iterations} started`)

      try {
        // Create fresh client per session to avoid SDK child process accumulation
        const client = clientFactory.create()

        const session = new Session({
          projectDir: this.options.projectDir,
          model: this.options.model,
        })

        const result = await session.run(client, instruction, logger)

        // Reset error counter on successful session and add cost
        state = state.resetErrors().addCost(result.costUsd)
        logger.info(
          `Session ${state.iterations}: cost=$${result.costUsd.toFixed(4)}, duration=${formatDuration(result.duration)}`,
        )

        // Read deliverable status after session
        const status = statusReader
          ? await statusReader.load()
          : DeliverableStatus.empty()

        state = state.updateDeliverableCounts(
          status.countPassed(),
          status.deliverables.length,
          status.countBlocked(),
        )

        // Post-session: evaluate all termination conditions
        const postDecision = this.runTerminationEvaluation(state, {
          sessionOutcome: result.outcome,
          quotaResetTime: result.quotaResetTime,
          deliverableStatus: statusReader ? status : undefined,
          signal,
        })

        // Handle quota wait (special case: not terminating, but waiting)
        if (postDecision.waitDuration !== undefined) {
          logger.info(
            `Quota exceeded, waiting ${formatDuration(postDecision.waitDuration)} until reset...`,
          )
          await this.timer.delay(postDecision.waitDuration)
          // Retry same session (don't count this iteration)
          state = state.decrementIterations()
          continue
        }

        // Handle termination
        if (postDecision.shouldTerminate && postDecision.exitReason) {
          this.logTermination(logger, postDecision.exitReason, state)
          state = state.setExitReason(postDecision.exitReason)
          break
        }

        // Delay before next session
        if (this.delayBetweenSessions > 0) {
          await this.timer.delay(this.delayBetweenSessions)
        }
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error))
        state = state.recordError(errorObj)

        // Check if max retries exceeded
        const errorDecision = this.runTerminationEvaluation(state, { signal })
        if (errorDecision.shouldTerminate && errorDecision.exitReason) {
          this.logTermination(logger, errorDecision.exitReason, state)
          state = state.setExitReason(errorDecision.exitReason)
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

  /**
   * Evaluate termination conditions
   */
  private runTerminationEvaluation(
    state: LoopState,
    partial: Partial<Omit<TerminationContext, 'state' | 'options'>>,
  ) {
    return evaluateTermination({
      state,
      options: {
        maxIterations: this.maxIterations,
        maxRetries: this.maxRetries,
        waitForQuota: this.options.waitForQuota,
      },
      ...partial,
    })
  }

  /**
   * Log termination reason with appropriate log level
   */
  private logTermination(
    logger: Logger,
    reason: ExitReason,
    state: LoopState,
  ): void {
    switch (reason) {
      case ExitReason.Interrupted:
        logger.info('User interrupted')
        break
      case ExitReason.QuotaExceeded:
        logger.error('Quota exceeded')
        break
      case ExitReason.AllPassed: {
        const blockedMsg =
          state.blockedCount > 0 ? ` (${state.blockedCount} blocked)` : ''
        logger.info(`All achievable deliverables passed${blockedMsg}`)
        break
      }
      case ExitReason.AllBlocked:
        logger.info(
          `All ${state.deliverablesTotalCount} deliverables are blocked`,
        )
        break
      case ExitReason.MaxIterations:
        logger.info(`Max iterations (${this.maxIterations}) reached`)
        break
      case ExitReason.MaxRetriesExceeded:
        logger.error(
          `Session failed after ${this.maxRetries} consecutive errors`,
        )
        break
    }
  }
}
