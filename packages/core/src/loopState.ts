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
 * Partial update for LoopState
 * All fields are optional - only specified fields are updated
 */
export interface LoopStateUpdate {
  incrementIterations?: boolean
  decrementIterations?: boolean
  addCost?: number
  error?: Error
  resetErrors?: boolean
  exitReason?: ExitReason
  deliverableCounts?: { passed: number; total: number; blocked: number }
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
 * Update loop state with partial updates
 * Combines multiple state mutations into a single pure function
 */
export function updateLoopState(
  state: LoopState,
  update: LoopStateUpdate,
): LoopState {
  let newState = { ...state }

  if (update.incrementIterations) {
    newState.iterations = newState.iterations + 1
  }

  if (update.decrementIterations) {
    newState.iterations = Math.max(0, newState.iterations - 1)
  }

  if (update.addCost !== undefined) {
    newState.totalCostUsd = newState.totalCostUsd + update.addCost
  }

  if (update.error !== undefined) {
    newState.consecutiveErrors = newState.consecutiveErrors + 1
    newState.lastError = update.error
  }

  if (update.resetErrors) {
    newState.consecutiveErrors = 0
  }

  if (update.exitReason !== undefined) {
    newState.exitReason = update.exitReason
  }

  if (update.deliverableCounts !== undefined) {
    newState.deliverablesPassedCount = update.deliverableCounts.passed
    newState.deliverablesTotalCount = update.deliverableCounts.total
    newState.blockedCount = update.deliverableCounts.blocked
  }

  return newState
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
