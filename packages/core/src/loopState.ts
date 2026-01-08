import { ExitReason } from './exitReason'

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
   * Create a new LoopState with specified changes
   */
  private clone(
    changes: Partial<{
      iterations: number
      totalCostUsd: number
      consecutiveErrors: number
      lastError: Error | undefined
      exitReason: ExitReason | undefined
      deliverablesPassedCount: number
      deliverablesTotalCount: number
      blockedCount: number
    }>,
  ): LoopState {
    return new LoopState(
      changes.iterations ?? this.iterations,
      changes.totalCostUsd ?? this.totalCostUsd,
      changes.consecutiveErrors ?? this.consecutiveErrors,
      'lastError' in changes ? changes.lastError : this.lastError,
      'exitReason' in changes ? changes.exitReason : this.exitReason,
      changes.deliverablesPassedCount ?? this.deliverablesPassedCount,
      changes.deliverablesTotalCount ?? this.deliverablesTotalCount,
      changes.blockedCount ?? this.blockedCount,
    )
  }

  /**
   * Increment iteration count
   */
  incrementIterations(): LoopState {
    return this.clone({ iterations: this.iterations + 1 })
  }

  /**
   * Decrement iteration count (minimum 0)
   */
  decrementIterations(): LoopState {
    return this.clone({ iterations: Math.max(0, this.iterations - 1) })
  }

  /**
   * Add cost to total
   */
  addCost(cost: number): LoopState {
    return this.clone({ totalCostUsd: this.totalCostUsd + cost })
  }

  /**
   * Record an error (increments consecutive error count)
   */
  recordError(error: Error): LoopState {
    return this.clone({
      consecutiveErrors: this.consecutiveErrors + 1,
      lastError: error,
    })
  }

  /**
   * Reset consecutive error count to 0
   */
  resetErrors(): LoopState {
    return this.clone({ consecutiveErrors: 0 })
  }

  /**
   * Set exit reason
   */
  setExitReason(reason: ExitReason): LoopState {
    return this.clone({ exitReason: reason })
  }

  /**
   * Update deliverable counts
   */
  updateDeliverableCounts(
    passed: number,
    total: number,
    blocked: number,
  ): LoopState {
    return this.clone({
      deliverablesPassedCount: passed,
      deliverablesTotalCount: total,
      blockedCount: blocked,
    })
  }
}
