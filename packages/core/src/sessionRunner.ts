import type { AgentClientFactory } from './agentClient'
import type {
  DeliverableStatusReader,
  DeliverableStatus,
} from './deliverableStatus'
import type { Logger } from './logger'
import type { InstructionResolver } from './instructions'
import type { Timer } from './timer'
import type { LoopState } from './loopState'
import type {
  TerminationEvaluator,
  TerminationContext,
  TerminationDecision,
} from './terminationEvaluator'
import { silentLogger } from './logger'
import { Session } from './session'
import {
  countPassedDeliverables,
  countBlockedDeliverables,
  emptyDeliverableStatus,
} from './deliverableStatus'
import { initializerInstruction, codingInstruction } from './instructions'
import { SessionOutcome } from './types'
import { formatDuration } from './duration'
import { realTimer } from './timer'
import {
  createInitialLoopState,
  updateLoopState,
  buildResult,
} from './loopState'
import { createDefaultTerminationChain } from './terminationEvaluator'

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
  /** Termination evaluator chain (default: createDefaultTerminationChain()) */
  terminationChain?: TerminationEvaluator
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
  private readonly terminationChain: TerminationEvaluator

  constructor(private options: SessionRunnerOptions) {
    this.delayBetweenSessions = options.delayBetweenSessions ?? 3000
    this.maxIterations = options.maxIterations
    this.maxRetries = options.maxRetries ?? 3
    this.timer = options.timer ?? realTimer
    this.terminationChain =
      options.terminationChain ?? createDefaultTerminationChain()
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
      // Pre-session: check interrupt
      const preDecision = this.evaluateTermination(state, { signal })
      if (preDecision.shouldTerminate && preDecision.exitReason) {
        this.logTermination(logger, preDecision.exitReason, state)
        state = updateLoopState(state, { exitReason: preDecision.exitReason })
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

      state = updateLoopState(state, { incrementIterations: true })
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
        state = updateLoopState(state, {
          resetErrors: true,
          addCost: result.costUsd,
        })
        logger.info(
          `Session ${state.iterations}: cost=$${result.costUsd.toFixed(4)}, duration=${formatDuration(result.duration)}`,
        )

        // Read deliverable status after session
        const status = statusReader
          ? await statusReader.load()
          : emptyDeliverableStatus()

        state = updateLoopState(state, {
          deliverableCounts: {
            passed: countPassedDeliverables(status),
            total: status.deliverables.length,
            blocked: countBlockedDeliverables(status),
          },
        })

        // Post-session: evaluate all termination conditions
        const postDecision = this.evaluateTermination(state, {
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
          state = updateLoopState(state, { decrementIterations: true })
          continue
        }

        // Handle termination
        if (postDecision.shouldTerminate && postDecision.exitReason) {
          this.logTermination(logger, postDecision.exitReason, state)
          state = updateLoopState(state, {
            exitReason: postDecision.exitReason,
          })
          break
        }

        // Delay before next session
        if (this.delayBetweenSessions > 0) {
          await this.timer.delay(this.delayBetweenSessions)
        }
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error))
        state = updateLoopState(state, { error: errorObj })

        // Check if max retries exceeded
        const errorDecision = this.evaluateTermination(state, { signal })
        if (errorDecision.shouldTerminate && errorDecision.exitReason) {
          this.logTermination(logger, errorDecision.exitReason, state)
          state = updateLoopState(state, {
            exitReason: errorDecision.exitReason,
          })
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
   * Build termination context from current state and partial context
   */
  private buildTerminationContext(
    state: LoopState,
    partial: Partial<Omit<TerminationContext, 'state' | 'options'>>,
  ): TerminationContext {
    return {
      state,
      options: {
        maxIterations: this.maxIterations,
        maxRetries: this.maxRetries,
        waitForQuota: this.options.waitForQuota,
      },
      ...partial,
    }
  }

  /**
   * Evaluate termination conditions using the termination chain
   */
  private evaluateTermination(
    state: LoopState,
    partial: Partial<Omit<TerminationContext, 'state' | 'options'>>,
  ): TerminationDecision {
    const context = this.buildTerminationContext(state, partial)
    return this.terminationChain.evaluate(context)
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
