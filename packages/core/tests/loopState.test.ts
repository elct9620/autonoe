import { describe, it, expect } from 'vitest'
import { LoopState } from '../src/loopState'
import { ExitReason } from '../src/sessionRunner'

/**
 * LoopState Tests
 * Tests for the immutable loop state class
 */
describe('LoopState', () => {
  describe('create', () => {
    it('LS-001: creates state with zero iterations', () => {
      const state = LoopState.create()
      expect(state.iterations).toBe(0)
    })

    it('LS-002: creates state with zero cost', () => {
      const state = LoopState.create()
      expect(state.totalCostUsd).toBe(0)
    })

    it('LS-003: creates state with zero consecutive errors', () => {
      const state = LoopState.create()
      expect(state.consecutiveErrors).toBe(0)
    })

    it('LS-004: creates state with no exit reason', () => {
      const state = LoopState.create()
      expect(state.exitReason).toBeUndefined()
    })

    it('LS-005: creates state with zero deliverable counts', () => {
      const state = LoopState.create()
      expect(state.deliverablesPassedCount).toBe(0)
      expect(state.deliverablesTotalCount).toBe(0)
      expect(state.blockedCount).toBe(0)
    })
  })

  describe('incrementIterations', () => {
    it('LS-010: increments iteration count by 1', () => {
      const initial = LoopState.create()
      const next = initial.incrementIterations()
      expect(next.iterations).toBe(1)
    })

    it('LS-011: does not mutate original state', () => {
      const initial = LoopState.create()
      initial.incrementIterations()
      expect(initial.iterations).toBe(0)
    })

    it('LS-012: preserves other state properties', () => {
      const initial = LoopState.create().addCost(1.5)
      const next = initial.incrementIterations()
      expect(next.totalCostUsd).toBe(1.5)
    })
  })

  describe('decrementIterations', () => {
    it('LS-015: decrements iteration count by 1', () => {
      const state = LoopState.create()
        .incrementIterations()
        .incrementIterations()
        .incrementIterations()
        .incrementIterations()
        .incrementIterations()
      const next = state.decrementIterations()
      expect(next.iterations).toBe(4)
    })

    it('LS-016: does not go below zero', () => {
      const initial = LoopState.create()
      const next = initial.decrementIterations()
      expect(next.iterations).toBe(0)
    })
  })

  describe('addCost', () => {
    it('LS-020: adds cost to total', () => {
      const initial = LoopState.create()
      const next = initial.addCost(0.5)
      expect(next.totalCostUsd).toBe(0.5)
    })

    it('LS-021: accumulates costs', () => {
      const state = LoopState.create().addCost(0.5).addCost(0.3)
      expect(state.totalCostUsd).toBe(0.8)
    })
  })

  describe('recordError', () => {
    it('LS-030: increments consecutive error count', () => {
      const initial = LoopState.create()
      const error = new Error('test error')
      const next = initial.recordError(error)
      expect(next.consecutiveErrors).toBe(1)
    })

    it('LS-031: stores the last error', () => {
      const initial = LoopState.create()
      const error = new Error('test error')
      const next = initial.recordError(error)
      expect(next.lastError).toBe(error)
    })

    it('LS-032: accumulates error count', () => {
      const state = LoopState.create()
        .recordError(new Error('error 1'))
        .recordError(new Error('error 2'))
      expect(state.consecutiveErrors).toBe(2)
    })
  })

  describe('resetErrors', () => {
    it('LS-040: resets consecutive error count to zero', () => {
      const state = LoopState.create()
        .recordError(new Error('test'))
        .recordError(new Error('test'))
        .resetErrors()
      expect(state.consecutiveErrors).toBe(0)
    })

    it('LS-041: preserves other state', () => {
      const state = LoopState.create()
        .incrementIterations()
        .addCost(1.0)
        .recordError(new Error('test'))
        .resetErrors()
      expect(state.iterations).toBe(1)
      expect(state.totalCostUsd).toBe(1.0)
    })
  })

  describe('setExitReason', () => {
    it('LS-050: sets exit reason', () => {
      const initial = LoopState.create()
      const next = initial.setExitReason(ExitReason.AllPassed)
      expect(next.exitReason).toBe(ExitReason.AllPassed)
    })

    it('LS-051: can set different exit reasons', () => {
      const initial = LoopState.create()

      expect(initial.setExitReason(ExitReason.Interrupted).exitReason).toBe(
        ExitReason.Interrupted,
      )
      expect(initial.setExitReason(ExitReason.QuotaExceeded).exitReason).toBe(
        ExitReason.QuotaExceeded,
      )
      expect(initial.setExitReason(ExitReason.MaxIterations).exitReason).toBe(
        ExitReason.MaxIterations,
      )
    })
  })

  describe('updateDeliverableCounts', () => {
    it('LS-060: updates all deliverable counts', () => {
      const initial = LoopState.create()
      const next = initial.updateDeliverableCounts(3, 5, 1)
      expect(next.deliverablesPassedCount).toBe(3)
      expect(next.deliverablesTotalCount).toBe(5)
      expect(next.blockedCount).toBe(1)
    })
  })

  describe('method chaining', () => {
    it('LS-080: handles multiple updates via chaining', () => {
      const next = LoopState.create()
        .incrementIterations()
        .addCost(0.5)
        .resetErrors()
      expect(next.iterations).toBe(1)
      expect(next.totalCostUsd).toBe(0.5)
      expect(next.consecutiveErrors).toBe(0)
    })
  })
})
