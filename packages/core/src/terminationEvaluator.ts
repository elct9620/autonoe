import type { LoopState } from './loopState'
import type { DeliverableStatus } from './deliverableStatus'
import type { ExitReason } from './exitReason'
import type { SessionOutcome } from './types'
import type { VerificationTracker } from './verificationTracker'
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
  verificationTracker?: VerificationTracker
  signal?: AbortSignal
  options: {
    maxIterations?: number
    maxRetries: number
    waitForQuota?: boolean
    useSyncTermination?: boolean
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
  | { action: 'wait'; durationMs: number; resetTime?: Date }
  | { action: 'continue' }

/**
 * Evaluate termination conditions with priority order:
 *
 * For run command:
 * 1. Interrupted (SIGINT)
 * 2. Quota exceeded
 * 3. All achievable deliverables passed
 * 4. All deliverables blocked
 * 5. Max iterations reached
 * 6. Max retries exceeded
 *
 * For sync command (useSyncTermination=true):
 * 1. Interrupted (SIGINT)
 * 2. Quota exceeded
 * 3. All deliverables verified (allVerified)
 * 4. Max iterations reached
 * 5. Max retries exceeded
 *
 * @see SPEC.md Section 3.10, Section 9.9
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
      return {
        action: 'wait',
        durationMs: waitMs,
        resetTime: context.quotaResetTime,
      }
    }
    return { action: 'terminate', exitReason: 'quota_exceeded' }
  }

  // Sync command uses verification-based termination
  if (context.options.useSyncTermination) {
    // 3. All deliverables verified
    if (context.verificationTracker?.allVerified()) {
      return { action: 'terminate', exitReason: 'all_verified' }
    }
  } else {
    // Run command uses pass/block-based termination
    // 3. All achievable deliverables passed
    if (context.deliverableStatus?.allAchievablePassed()) {
      return { action: 'terminate', exitReason: 'all_passed' }
    }

    // 4. All deliverables blocked
    if (context.deliverableStatus?.allBlocked()) {
      return { action: 'terminate', exitReason: 'all_blocked' }
    }
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
