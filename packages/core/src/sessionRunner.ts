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
import type { ExitReason } from './exitReason'

// Re-export for API compatibility
export type { ExitReason } from './exitReason'

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
    iterations: state.iterations,
    deliverablesPassedCount: state.deliverablesPassedCount,
    deliverablesTotalCount: state.deliverablesTotalCount,
    blockedCount: state.blockedCount,
    totalDuration,
    totalCostUsd: state.totalCostUsd,
    interrupted: state.exitReason === 'interrupted',
    quotaExceeded: state.exitReason === 'quota_exceeded',
    error:
      state.exitReason === 'max_retries_exceeded'
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
      if (preDecision.action === 'terminate') {
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
        const session = new Session()
        const result = await session.run(client, instruction, logger)

        // Reset error counter on successful session and add cost
        state = state.resetErrors().addCost(result.costUsd)
        logger.info(
          `Session ${state.iterations}: cost=$${result.costUsd.toFixed(4)}, duration=${formatDuration(result.duration)}`,
        )

        // Load deliverable status and update counts
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

        // Handle decision
        const decisionResult = await this.handleTerminationDecision(
          postDecision,
          state,
          logger,
        )
        state = decisionResult.state

        if (decisionResult.action === 'break') {
          break
        }
        if (decisionResult.action === 'continue') {
          continue
        }

        // Delay before next session
        if (this.delayBetweenSessions > 0) {
          await this.timer.delay(this.delayBetweenSessions)
        }
      } catch (error) {
        const errorResult = await this.handleSessionError(
          error,
          state,
          signal,
          logger,
        )
        state = errorResult.state
        if (errorResult.shouldBreak) {
          break
        }
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
   * Handle termination decision and return updated state with control flow signal
   */
  private async handleTerminationDecision(
    decision: ReturnType<typeof evaluateTermination>,
    state: LoopState,
    logger: Logger,
  ): Promise<{ state: LoopState; action: 'break' | 'continue' | 'next' }> {
    switch (decision.action) {
      case 'terminate':
        this.logTermination(logger, decision.exitReason, state)
        return {
          state: state.setExitReason(decision.exitReason),
          action: 'break',
        }
      case 'wait':
        logger.info(
          `Quota exceeded, waiting ${formatDuration(decision.durationMs)} until reset...`,
        )
        await this.timer.delay(decision.durationMs)
        return {
          state: state.decrementIterations(),
          action: 'continue',
        }
      case 'continue':
        return { state, action: 'next' }
    }
  }

  /**
   * Handle session error with retry logic
   */
  private async handleSessionError(
    error: unknown,
    state: LoopState,
    signal: AbortSignal | undefined,
    logger: Logger,
  ): Promise<{ state: LoopState; shouldBreak: boolean }> {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    const newState = state.recordError(errorObj)

    const decision = this.runTerminationEvaluation(newState, { signal })
    if (decision.action === 'terminate') {
      this.logTermination(logger, decision.exitReason, newState)
      return {
        state: newState.setExitReason(decision.exitReason),
        shouldBreak: true,
      }
    }

    logger.warn(
      `Session error (${newState.consecutiveErrors}/${this.maxRetries}), starting new session...`,
    )
    await this.timer.delay(this.delayBetweenSessions)
    return { state: newState, shouldBreak: false }
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
      case 'interrupted':
        logger.info('User interrupted')
        break
      case 'quota_exceeded':
        logger.error('Quota exceeded')
        break
      case 'all_passed': {
        const blockedMsg =
          state.blockedCount > 0 ? ` (${state.blockedCount} blocked)` : ''
        logger.info(`All achievable deliverables passed${blockedMsg}`)
        break
      }
      case 'all_blocked':
        logger.info(
          `All ${state.deliverablesTotalCount} deliverables are blocked`,
        )
        break
      case 'max_iterations':
        logger.info(`Max iterations (${this.maxIterations}) reached`)
        break
      case 'max_retries_exceeded':
        logger.error(
          `Session failed after ${this.maxRetries} consecutive errors`,
        )
        break
    }
  }
}
