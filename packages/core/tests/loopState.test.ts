import { describe, it, expect } from 'vitest'
import {
  createInitialLoopState,
  updateLoopState,
  buildResult,
} from '../src/loopState'
import { ExitReason } from '../src/sessionRunner'

/**
 * LoopState Tests
 * Tests for the immutable loop state value object
 */
describe('LoopState', () => {
  describe('createInitialLoopState', () => {
    it('LS-001: creates state with zero iterations', () => {
      const state = createInitialLoopState()
      expect(state.iterations).toBe(0)
    })

    it('LS-002: creates state with zero cost', () => {
      const state = createInitialLoopState()
      expect(state.totalCostUsd).toBe(0)
    })

    it('LS-003: creates state with zero consecutive errors', () => {
      const state = createInitialLoopState()
      expect(state.consecutiveErrors).toBe(0)
    })

    it('LS-004: creates state with no exit reason', () => {
      const state = createInitialLoopState()
      expect(state.exitReason).toBeUndefined()
    })

    it('LS-005: creates state with zero deliverable counts', () => {
      const state = createInitialLoopState()
      expect(state.deliverablesPassedCount).toBe(0)
      expect(state.deliverablesTotalCount).toBe(0)
      expect(state.blockedCount).toBe(0)
    })
  })

  describe('updateLoopState', () => {
    describe('incrementIterations', () => {
      it('LS-010: increments iteration count by 1', () => {
        const initial = createInitialLoopState()
        const next = updateLoopState(initial, { incrementIterations: true })
        expect(next.iterations).toBe(1)
      })

      it('LS-011: does not mutate original state', () => {
        const initial = createInitialLoopState()
        updateLoopState(initial, { incrementIterations: true })
        expect(initial.iterations).toBe(0)
      })

      it('LS-012: preserves other state properties', () => {
        const initial = { ...createInitialLoopState(), totalCostUsd: 1.5 }
        const next = updateLoopState(initial, { incrementIterations: true })
        expect(next.totalCostUsd).toBe(1.5)
      })
    })

    describe('decrementIterations', () => {
      it('LS-015: decrements iteration count by 1', () => {
        const state = { ...createInitialLoopState(), iterations: 5 }
        const next = updateLoopState(state, { decrementIterations: true })
        expect(next.iterations).toBe(4)
      })

      it('LS-016: does not go below zero', () => {
        const initial = createInitialLoopState()
        const next = updateLoopState(initial, { decrementIterations: true })
        expect(next.iterations).toBe(0)
      })
    })

    describe('addCost', () => {
      it('LS-020: adds cost to total', () => {
        const initial = createInitialLoopState()
        const next = updateLoopState(initial, { addCost: 0.5 })
        expect(next.totalCostUsd).toBe(0.5)
      })

      it('LS-021: accumulates costs', () => {
        let state = createInitialLoopState()
        state = updateLoopState(state, { addCost: 0.5 })
        state = updateLoopState(state, { addCost: 0.3 })
        expect(state.totalCostUsd).toBe(0.8)
      })
    })

    describe('error', () => {
      it('LS-030: increments consecutive error count', () => {
        const initial = createInitialLoopState()
        const error = new Error('test error')
        const next = updateLoopState(initial, { error })
        expect(next.consecutiveErrors).toBe(1)
      })

      it('LS-031: stores the last error', () => {
        const initial = createInitialLoopState()
        const error = new Error('test error')
        const next = updateLoopState(initial, { error })
        expect(next.lastError).toBe(error)
      })

      it('LS-032: accumulates error count', () => {
        let state = createInitialLoopState()
        state = updateLoopState(state, { error: new Error('error 1') })
        state = updateLoopState(state, { error: new Error('error 2') })
        expect(state.consecutiveErrors).toBe(2)
      })
    })

    describe('resetErrors', () => {
      it('LS-040: resets consecutive error count to zero', () => {
        let state = createInitialLoopState()
        state = updateLoopState(state, { error: new Error('test') })
        state = updateLoopState(state, { error: new Error('test') })
        state = updateLoopState(state, { resetErrors: true })
        expect(state.consecutiveErrors).toBe(0)
      })

      it('LS-041: preserves other state', () => {
        let state = createInitialLoopState()
        state = updateLoopState(state, { incrementIterations: true })
        state = updateLoopState(state, { addCost: 1.0 })
        state = updateLoopState(state, { error: new Error('test') })
        state = updateLoopState(state, { resetErrors: true })
        expect(state.iterations).toBe(1)
        expect(state.totalCostUsd).toBe(1.0)
      })
    })

    describe('exitReason', () => {
      it('LS-050: sets exit reason', () => {
        const initial = createInitialLoopState()
        const next = updateLoopState(initial, {
          exitReason: ExitReason.AllPassed,
        })
        expect(next.exitReason).toBe(ExitReason.AllPassed)
      })

      it('LS-051: can set different exit reasons', () => {
        const initial = createInitialLoopState()

        expect(
          updateLoopState(initial, { exitReason: ExitReason.Interrupted })
            .exitReason,
        ).toBe(ExitReason.Interrupted)
        expect(
          updateLoopState(initial, { exitReason: ExitReason.QuotaExceeded })
            .exitReason,
        ).toBe(ExitReason.QuotaExceeded)
        expect(
          updateLoopState(initial, { exitReason: ExitReason.MaxIterations })
            .exitReason,
        ).toBe(ExitReason.MaxIterations)
      })
    })

    describe('deliverableCounts', () => {
      it('LS-060: updates all deliverable counts', () => {
        const initial = createInitialLoopState()
        const next = updateLoopState(initial, {
          deliverableCounts: { passed: 3, total: 5, blocked: 1 },
        })
        expect(next.deliverablesPassedCount).toBe(3)
        expect(next.deliverablesTotalCount).toBe(5)
        expect(next.blockedCount).toBe(1)
      })
    })

    describe('combined updates', () => {
      it('LS-080: handles multiple updates in one call', () => {
        const initial = createInitialLoopState()
        const next = updateLoopState(initial, {
          incrementIterations: true,
          addCost: 0.5,
          resetErrors: true,
        })
        expect(next.iterations).toBe(1)
        expect(next.totalCostUsd).toBe(0.5)
        expect(next.consecutiveErrors).toBe(0)
      })

      it('LS-081: handles increment and decrement in same call', () => {
        const state = { ...createInitialLoopState(), iterations: 5 }
        // Both flags set - increment happens first, then decrement
        const next = updateLoopState(state, {
          incrementIterations: true,
          decrementIterations: true,
        })
        // 5 + 1 = 6, then 6 - 1 = 5
        expect(next.iterations).toBe(5)
      })
    })
  })

  describe('buildResult', () => {
    it('LS-070: builds success result when AllPassed', () => {
      let state = createInitialLoopState()
      state = updateLoopState(state, { incrementIterations: true })
      state = updateLoopState(state, { addCost: 0.5 })
      state = updateLoopState(state, {
        deliverableCounts: { passed: 3, total: 3, blocked: 0 },
      })
      state = updateLoopState(state, { exitReason: ExitReason.AllPassed })

      const result = buildResult(state, 1000)

      expect(result.success).toBe(true)
      expect(result.iterations).toBe(1)
      expect(result.totalCostUsd).toBe(0.5)
      expect(result.deliverablesPassedCount).toBe(3)
      expect(result.deliverablesTotalCount).toBe(3)
      expect(result.totalDuration).toBe(1000)
    })

    it('LS-071: builds interrupted result', () => {
      let state = createInitialLoopState()
      state = updateLoopState(state, { exitReason: ExitReason.Interrupted })

      const result = buildResult(state, 500)

      expect(result.success).toBe(false)
      expect(result.interrupted).toBe(true)
    })

    it('LS-072: builds quota exceeded result', () => {
      let state = createInitialLoopState()
      state = updateLoopState(state, { exitReason: ExitReason.QuotaExceeded })

      const result = buildResult(state, 500)

      expect(result.success).toBe(false)
      expect(result.quotaExceeded).toBe(true)
    })

    it('LS-073: builds error result with error message', () => {
      let state = createInitialLoopState()
      state = updateLoopState(state, { error: new Error('Connection failed') })
      state = updateLoopState(state, {
        exitReason: ExitReason.MaxRetriesExceeded,
      })

      const result = buildResult(state, 500)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
    })

    it('LS-074: includes blocked count', () => {
      let state = createInitialLoopState()
      state = updateLoopState(state, {
        deliverableCounts: { passed: 2, total: 5, blocked: 3 },
      })
      state = updateLoopState(state, { exitReason: ExitReason.AllBlocked })

      const result = buildResult(state, 500)

      expect(result.blockedCount).toBe(3)
    })
  })
})
