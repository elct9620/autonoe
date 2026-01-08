import type { LoopState } from './loopState'
import type { DeliverableStatus } from './deliverableStatus'
import { ExitReason } from './exitReason'
import type { SessionOutcome } from './types'
import { calculateWaitDuration } from './quotaManager'

/**
 * Context for termination evaluation
 * Contains all data needed to decide if loop should terminate
 */
export interface TerminationContext {
  state: LoopState
  sessionOutcome?: SessionOutcome
  quotaResetTime?: Date
  deliverableStatus?: DeliverableStatus
  signal?: AbortSignal
  options: {
    maxIterations?: number
    maxRetries: number
    waitForQuota?: boolean
  }
}

/**
 * Decision returned by termination evaluator
 */
export interface TerminationDecision {
  shouldTerminate: boolean
  exitReason?: ExitReason
  /** Wait duration in ms before retrying (for quota wait) */
  waitDuration?: number
}

/**
 * Evaluate termination conditions with priority order:
 * 1. Interrupted (SIGINT)
 * 2. Quota exceeded
 * 3. All achievable deliverables passed
 * 4. All deliverables blocked
 * 5. Max iterations reached
 * 6. Max retries exceeded
 *
 * @see SPEC.md Section 3.10
 */
export function evaluateTermination(
  context: TerminationContext,
): TerminationDecision {
  // 1. Interrupted (highest priority)
  if (context.signal?.aborted) {
    return { shouldTerminate: true, exitReason: ExitReason.Interrupted }
  }

  // 2. Quota exceeded
  if (context.sessionOutcome === 'quota_exceeded') {
    if (context.options.waitForQuota && context.quotaResetTime) {
      const waitMs = calculateWaitDuration(context.quotaResetTime)
      return { shouldTerminate: false, waitDuration: waitMs }
    }
    return { shouldTerminate: true, exitReason: ExitReason.QuotaExceeded }
  }

  // 3. All achievable deliverables passed
  if (context.deliverableStatus?.allAchievablePassed()) {
    return { shouldTerminate: true, exitReason: ExitReason.AllPassed }
  }

  // 4. All deliverables blocked
  if (context.deliverableStatus?.allBlocked()) {
    return { shouldTerminate: true, exitReason: ExitReason.AllBlocked }
  }

  // 5. Max iterations reached
  if (
    context.options.maxIterations !== undefined &&
    context.state.iterations >= context.options.maxIterations
  ) {
    return { shouldTerminate: true, exitReason: ExitReason.MaxIterations }
  }

  // 6. Max retries exceeded
  if (context.state.consecutiveErrors > context.options.maxRetries) {
    return { shouldTerminate: true, exitReason: ExitReason.MaxRetriesExceeded }
  }

  return { shouldTerminate: false }
}
