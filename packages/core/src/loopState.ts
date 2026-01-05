import type { SessionRunnerResult } from './sessionRunner'
import { ExitReason } from './sessionRunner'

/**
 * Immutable value object representing session runner loop state
 * Enables pure function state transitions for testability
 * @see SPEC.md Section 3.9 SessionRunner
 */
export interface LoopState {
  readonly iterations: number
  readonly totalCostUsd: number
  readonly consecutiveErrors: number
  readonly lastError: Error | undefined
  readonly exitReason: ExitReason | undefined
  readonly deliverablesPassedCount: number
  readonly deliverablesTotalCount: number
  readonly blockedCount: number
}

/**
 * Create initial loop state with default values
 */
export function createInitialLoopState(): LoopState {
  return {
    iterations: 0,
    totalCostUsd: 0,
    consecutiveErrors: 0,
    lastError: undefined,
    exitReason: undefined,
    deliverablesPassedCount: 0,
    deliverablesTotalCount: 0,
    blockedCount: 0,
  }
}

/**
 * Increment iteration count
 */
export function incrementIteration(state: LoopState): LoopState {
  return {
    ...state,
    iterations: state.iterations + 1,
  }
}

/**
 * Decrement iteration count (used for quota retry)
 */
export function decrementIteration(state: LoopState): LoopState {
  return {
    ...state,
    iterations: Math.max(0, state.iterations - 1),
  }
}

/**
 * Add cost to total
 */
export function addCost(state: LoopState, cost: number): LoopState {
  return {
    ...state,
    totalCostUsd: state.totalCostUsd + cost,
  }
}

/**
 * Record an error and increment consecutive error count
 */
export function recordError(state: LoopState, error: Error): LoopState {
  return {
    ...state,
    consecutiveErrors: state.consecutiveErrors + 1,
    lastError: error,
  }
}

/**
 * Reset consecutive error count after successful session
 */
export function resetErrors(state: LoopState): LoopState {
  return {
    ...state,
    consecutiveErrors: 0,
  }
}

/**
 * Set the exit reason for loop termination
 */
export function setExitReason(state: LoopState, reason: ExitReason): LoopState {
  return {
    ...state,
    exitReason: reason,
  }
}

/**
 * Update deliverable counts from status
 */
export function updateDeliverableCounts(
  state: LoopState,
  passed: number,
  total: number,
  blocked: number,
): LoopState {
  return {
    ...state,
    deliverablesPassedCount: passed,
    deliverablesTotalCount: total,
    blockedCount: blocked,
  }
}

/**
 * Build SessionRunnerResult from loop state
 */
export function buildResult(
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
