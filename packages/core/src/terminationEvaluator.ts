import type { LoopState } from './loopState'
import type { DeliverableStatus } from './deliverableStatus'
import type { ExitReason } from './exitReason'
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
 * Discriminated union with three possible actions:
 * - terminate: stop loop with exit reason
 * - wait: pause before retry (quota wait)
 * - continue: proceed to next iteration
 */
export type TerminationDecision =
  | { action: 'terminate'; exitReason: ExitReason }
  | { action: 'wait'; durationMs: number }
  | { action: 'continue' }

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
    return { action: 'terminate', exitReason: 'interrupted' }
  }

  // 2. Quota exceeded
  if (context.sessionOutcome === 'quota_exceeded') {
    if (context.options.waitForQuota && context.quotaResetTime) {
      const waitMs = calculateWaitDuration(context.quotaResetTime)
      return { action: 'wait', durationMs: waitMs }
    }
    return { action: 'terminate', exitReason: 'quota_exceeded' }
  }

  // 3. All achievable deliverables passed
  if (context.deliverableStatus?.allAchievablePassed()) {
    return { action: 'terminate', exitReason: 'all_passed' }
  }

  // 4. All deliverables blocked
  if (context.deliverableStatus?.allBlocked()) {
    return { action: 'terminate', exitReason: 'all_blocked' }
  }

  // 5. Max iterations reached
  if (
    context.options.maxIterations !== undefined &&
    context.state.iterations >= context.options.maxIterations
  ) {
    return { action: 'terminate', exitReason: 'max_iterations' }
  }

  // 6. Max retries exceeded
  if (context.state.consecutiveErrors > context.options.maxRetries) {
    return { action: 'terminate', exitReason: 'max_retries_exceeded' }
  }

  return { action: 'continue' }
}
