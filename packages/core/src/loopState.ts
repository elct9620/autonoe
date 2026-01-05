import type { SessionRunnerResult } from './sessionRunner'
import { ExitReason } from './sessionRunner'

/**
 * Immutable value object representing session runner loop state
 * All update methods return new instances
 * @see SPEC.md Section 3.9 SessionRunner
 */
export class LoopState {
  private constructor(
    readonly iterations: number,
    readonly totalCostUsd: number,
    readonly consecutiveErrors: number,
    readonly lastError: Error | undefined,
    readonly exitReason: ExitReason | undefined,
    readonly deliverablesPassedCount: number,
    readonly deliverablesTotalCount: number,
    readonly blockedCount: number,
  ) {}

  /**
   * Create initial loop state with default values
   */
  static create(): LoopState {
    return new LoopState(0, 0, 0, undefined, undefined, 0, 0, 0)
  }

  /**
   * Increment iteration count
   */
  incrementIterations(): LoopState {
    return new LoopState(
      this.iterations + 1,
      this.totalCostUsd,
      this.consecutiveErrors,
      this.lastError,
      this.exitReason,
      this.deliverablesPassedCount,
      this.deliverablesTotalCount,
      this.blockedCount,
    )
  }

  /**
   * Decrement iteration count (minimum 0)
   */
  decrementIterations(): LoopState {
    return new LoopState(
      Math.max(0, this.iterations - 1),
      this.totalCostUsd,
      this.consecutiveErrors,
      this.lastError,
      this.exitReason,
      this.deliverablesPassedCount,
      this.deliverablesTotalCount,
      this.blockedCount,
    )
  }

  /**
   * Add cost to total
   */
  addCost(cost: number): LoopState {
    return new LoopState(
      this.iterations,
      this.totalCostUsd + cost,
      this.consecutiveErrors,
      this.lastError,
      this.exitReason,
      this.deliverablesPassedCount,
      this.deliverablesTotalCount,
      this.blockedCount,
    )
  }

  /**
   * Record an error (increments consecutive error count)
   */
  recordError(error: Error): LoopState {
    return new LoopState(
      this.iterations,
      this.totalCostUsd,
      this.consecutiveErrors + 1,
      error,
      this.exitReason,
      this.deliverablesPassedCount,
      this.deliverablesTotalCount,
      this.blockedCount,
    )
  }

  /**
   * Reset consecutive error count to 0
   */
  resetErrors(): LoopState {
    return new LoopState(
      this.iterations,
      this.totalCostUsd,
      0,
      this.lastError,
      this.exitReason,
      this.deliverablesPassedCount,
      this.deliverablesTotalCount,
      this.blockedCount,
    )
  }

  /**
   * Set exit reason
   */
  setExitReason(reason: ExitReason): LoopState {
    return new LoopState(
      this.iterations,
      this.totalCostUsd,
      this.consecutiveErrors,
      this.lastError,
      reason,
      this.deliverablesPassedCount,
      this.deliverablesTotalCount,
      this.blockedCount,
    )
  }

  /**
   * Update deliverable counts
   */
  updateDeliverableCounts(
    passed: number,
    total: number,
    blocked: number,
  ): LoopState {
    return new LoopState(
      this.iterations,
      this.totalCostUsd,
      this.consecutiveErrors,
      this.lastError,
      this.exitReason,
      passed,
      total,
      blocked,
    )
  }

  /**
   * Build SessionRunnerResult from this state
   */
  toResult(totalDuration: number): SessionRunnerResult {
    return {
      success: this.exitReason === ExitReason.AllPassed,
      iterations: this.iterations,
      deliverablesPassedCount: this.deliverablesPassedCount,
      deliverablesTotalCount: this.deliverablesTotalCount,
      blockedCount: this.blockedCount,
      totalDuration,
      totalCostUsd: this.totalCostUsd,
      interrupted: this.exitReason === ExitReason.Interrupted,
      quotaExceeded: this.exitReason === ExitReason.QuotaExceeded,
      error:
        this.exitReason === ExitReason.MaxRetriesExceeded
          ? this.lastError?.message
          : undefined,
    }
  }
}
