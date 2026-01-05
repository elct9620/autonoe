import type { LoopState } from './loopState'
import type { DeliverableStatus } from './deliverableStatus'
import { ExitReason } from './sessionRunner'
import { SessionOutcome } from './types'
import {
  allAchievableDeliverablesPassed,
  allDeliverablesBlocked,
} from './deliverableStatus'
import { calculateWaitDuration } from './quotaLimit'

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
 * Interface for termination condition evaluators
 * Follows Strategy pattern for extensibility
 */
export interface TerminationEvaluator {
  evaluate(context: TerminationContext): TerminationDecision
}

// ============================================
// Individual Termination Strategies
// ============================================

/**
 * Evaluates if the session was interrupted by user (SIGINT)
 */
export class InterruptedEvaluator implements TerminationEvaluator {
  evaluate(context: TerminationContext): TerminationDecision {
    if (context.signal?.aborted) {
      return { shouldTerminate: true, exitReason: ExitReason.Interrupted }
    }
    return { shouldTerminate: false }
  }
}

/**
 * Evaluates quota exceeded condition
 * Can return wait duration if waitForQuota is enabled
 */
export class QuotaExceededEvaluator implements TerminationEvaluator {
  evaluate(context: TerminationContext): TerminationDecision {
    if (context.sessionOutcome !== SessionOutcome.QuotaExceeded) {
      return { shouldTerminate: false }
    }

    if (context.options.waitForQuota && context.quotaResetTime) {
      const waitMs = calculateWaitDuration(context.quotaResetTime)
      return { shouldTerminate: false, waitDuration: waitMs }
    }

    return { shouldTerminate: true, exitReason: ExitReason.QuotaExceeded }
  }
}

/**
 * Evaluates if all achievable deliverables have passed
 */
export class AllPassedEvaluator implements TerminationEvaluator {
  evaluate(context: TerminationContext): TerminationDecision {
    if (!context.deliverableStatus) {
      return { shouldTerminate: false }
    }

    if (
      context.deliverableStatus.deliverables.length > 0 &&
      allAchievableDeliverablesPassed(context.deliverableStatus)
    ) {
      return { shouldTerminate: true, exitReason: ExitReason.AllPassed }
    }

    return { shouldTerminate: false }
  }
}

/**
 * Evaluates if all deliverables are blocked
 */
export class AllBlockedEvaluator implements TerminationEvaluator {
  evaluate(context: TerminationContext): TerminationDecision {
    if (!context.deliverableStatus) {
      return { shouldTerminate: false }
    }

    if (
      context.deliverableStatus.deliverables.length > 0 &&
      allDeliverablesBlocked(context.deliverableStatus)
    ) {
      return { shouldTerminate: true, exitReason: ExitReason.AllBlocked }
    }

    return { shouldTerminate: false }
  }
}

/**
 * Evaluates if max iterations has been reached
 */
export class MaxIterationsEvaluator implements TerminationEvaluator {
  evaluate(context: TerminationContext): TerminationDecision {
    if (
      context.options.maxIterations !== undefined &&
      context.state.iterations >= context.options.maxIterations
    ) {
      return { shouldTerminate: true, exitReason: ExitReason.MaxIterations }
    }

    return { shouldTerminate: false }
  }
}

/**
 * Evaluates if max consecutive errors has been exceeded
 */
export class MaxRetriesEvaluator implements TerminationEvaluator {
  evaluate(context: TerminationContext): TerminationDecision {
    if (context.state.consecutiveErrors > context.options.maxRetries) {
      return {
        shouldTerminate: true,
        exitReason: ExitReason.MaxRetriesExceeded,
      }
    }

    return { shouldTerminate: false }
  }
}

// ============================================
// Composite Evaluator (Chain of Responsibility)
// ============================================

/**
 * Chains multiple evaluators and returns first termination decision
 */
export class TerminationChain implements TerminationEvaluator {
  constructor(private evaluators: TerminationEvaluator[]) {}

  evaluate(context: TerminationContext): TerminationDecision {
    for (const evaluator of this.evaluators) {
      const decision = evaluator.evaluate(context)
      if (decision.shouldTerminate || decision.waitDuration !== undefined) {
        return decision
      }
    }
    return { shouldTerminate: false }
  }
}

/**
 * Creates the default termination chain with standard priority order
 * Priority: Interrupted > QuotaExceeded > AllPassed > AllBlocked > MaxIterations > MaxRetries
 */
export function createDefaultTerminationChain(): TerminationChain {
  return new TerminationChain([
    new InterruptedEvaluator(),
    new QuotaExceededEvaluator(),
    new AllPassedEvaluator(),
    new AllBlockedEvaluator(),
    new MaxIterationsEvaluator(),
    new MaxRetriesEvaluator(),
  ])
}
