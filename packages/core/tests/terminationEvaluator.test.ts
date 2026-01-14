import { describe, it, expect } from 'vitest'
import {
  evaluateTermination,
  type TerminationContext,
} from '../src/terminationEvaluator'
import { LoopState } from '../src/loopState'
import { DeliverableStatus } from '../src/deliverableStatus'
import { Deliverable } from '../src/deliverable'
import { VerificationTracker } from '../src/verificationTracker'

/**
 * evaluateTermination Tests
 * Tests for the termination evaluation function
 * @see SPEC.md Section 3.10
 */

function createStateWithIterations(count: number): LoopState {
  let state = LoopState.create()
  for (let i = 0; i < count; i++) {
    state = state.incrementIterations()
  }
  return state
}

function createStateWithErrors(count: number): LoopState {
  let state = LoopState.create()
  for (let i = 0; i < count; i++) {
    state = state.recordError(new Error(`error ${i + 1}`))
  }
  return state
}

function createContext(
  overrides: Partial<TerminationContext> = {},
): TerminationContext {
  return {
    state: LoopState.create(),
    options: { maxRetries: 3 },
    ...overrides,
  }
}

describe('evaluateTermination', () => {
  describe('Interrupted condition', () => {
    it('TE-001: returns terminate action when signal is aborted', () => {
      const controller = new AbortController()
      controller.abort()

      const decision = evaluateTermination(
        createContext({ signal: controller.signal }),
      )

      expect(decision.action).toBe('terminate')
      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'interrupted',
      })
    })

    it('TE-002: returns continue action when signal is not aborted', () => {
      const controller = new AbortController()

      const decision = evaluateTermination(
        createContext({ signal: controller.signal }),
      )

      expect(decision.action).toBe('continue')
    })

    it('TE-003: returns continue action when no signal provided', () => {
      const decision = evaluateTermination(createContext())

      expect(decision.action).toBe('continue')
    })
  })

  describe('Quota exceeded condition', () => {
    it('TE-010: returns terminate action when quota exceeded without waitForQuota', () => {
      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'quota_exceeded',
          options: { maxRetries: 3, waitForQuota: false },
        }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'quota_exceeded',
      })
    })

    it('TE-011: returns wait action when quota exceeded with waitForQuota', () => {
      const futureTime = new Date(Date.now() + 60000) // 1 minute from now

      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'quota_exceeded',
          quotaResetTime: futureTime,
          options: { maxRetries: 3, waitForQuota: true },
        }),
      )

      expect(decision.action).toBe('wait')
      if (decision.action === 'wait') {
        expect(decision.durationMs).toBeGreaterThan(0)
      }
    })

    it('TE-012: returns continue action when outcome is not quota exceeded', () => {
      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'completed',
        }),
      )

      expect(decision.action).toBe('continue')
    })
  })

  describe('All passed condition', () => {
    it('TE-020: returns terminate action when all deliverables passed', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.passed('d1', 'Task 1', ['Done']),
        Deliverable.passed('d2', 'Task 2', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'all_passed',
      })
    })

    it('TE-021: returns terminate action when achievable deliverables passed (some blocked)', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.passed('d1', 'Task 1', ['Done']),
        Deliverable.blocked('d2', 'Task 2', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'all_passed',
      })
    })

    it('TE-022: returns continue action when not all deliverables passed', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.passed('d1', 'Task 1', ['Done']),
        Deliverable.pending('d2', 'Task 2', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision.action).toBe('continue')
    })

    it('TE-023: returns continue action when no deliverable status', () => {
      const decision = evaluateTermination(createContext())

      expect(decision.action).toBe('continue')
    })
  })

  describe('All blocked condition', () => {
    it('TE-030: returns terminate action when all deliverables blocked', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.blocked('d1', 'Task 1', ['Done']),
        Deliverable.blocked('d2', 'Task 2', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'all_blocked',
      })
    })

    it('TE-031: returns continue action when not all blocked', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.blocked('d1', 'Task 1', ['Done']),
        Deliverable.pending('d2', 'Task 2', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision.action).toBe('continue')
    })
  })

  describe('Max iterations condition', () => {
    it('TE-040: returns terminate action when max iterations reached', () => {
      const state = createStateWithIterations(5)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3, maxIterations: 5 },
        }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'max_iterations',
      })
    })

    it('TE-041: returns continue action when below max iterations', () => {
      const state = createStateWithIterations(3)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3, maxIterations: 5 },
        }),
      )

      expect(decision.action).toBe('continue')
    })

    it('TE-042: returns continue action when maxIterations not set', () => {
      const state = createStateWithIterations(100)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3 },
        }),
      )

      expect(decision.action).toBe('continue')
    })
  })

  describe('Max retries condition', () => {
    it('TE-050: returns terminate action when consecutive errors exceed max retries', () => {
      const state = createStateWithErrors(4)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3 },
        }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'max_retries_exceeded',
      })
    })

    it('TE-051: returns continue action when errors at max retries', () => {
      const state = createStateWithErrors(3)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3 },
        }),
      )

      expect(decision.action).toBe('continue')
    })

    it('TE-052: returns continue action when no errors', () => {
      const decision = evaluateTermination(createContext())

      expect(decision.action).toBe('continue')
    })
  })

  describe('Priority order', () => {
    it('TE-070: Interrupted has highest priority over other conditions', () => {
      const controller = new AbortController()
      controller.abort()

      const state = createStateWithIterations(5)
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.passed('d1', 'Task', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({
          signal: controller.signal,
          state,
          deliverableStatus: status,
          options: { maxRetries: 3, maxIterations: 5 },
        }),
      )

      // Should return Interrupted even though AllPassed and MaxIterations also match
      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'interrupted',
      })
    })

    it('TE-071: QuotaExceeded has priority over AllPassed', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.passed('d1', 'Task', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'quota_exceeded',
          deliverableStatus: status,
          options: { maxRetries: 3, waitForQuota: false },
        }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'quota_exceeded',
      })
    })

    it('TE-072: AllPassed has priority over MaxIterations', () => {
      const state = createStateWithIterations(5)
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        Deliverable.passed('d1', 'Task', ['Done']),
      ])

      const decision = evaluateTermination(
        createContext({
          state,
          deliverableStatus: status,
          options: { maxRetries: 3, maxIterations: 5 },
        }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'all_passed',
      })
    })
  })

  describe('Sync termination mode', () => {
    it('TE-080: returns all_verified when sync mode and all verified', () => {
      const tracker = VerificationTracker.fromIds(['DL-001', 'DL-002'])
      tracker.verify('DL-001')
      tracker.verify('DL-002')

      const decision = evaluateTermination(
        createContext({
          verificationTracker: tracker,
          options: { maxRetries: 3, useSyncTermination: true },
        }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'all_verified',
      })
    })

    it('TE-081: continues when sync mode but not all verified', () => {
      const tracker = VerificationTracker.fromIds(['DL-001', 'DL-002'])
      tracker.verify('DL-001')
      // DL-002 not verified

      const decision = evaluateTermination(
        createContext({
          verificationTracker: tracker,
          options: { maxRetries: 3, useSyncTermination: true },
        }),
      )

      expect(decision.action).toBe('continue')
    })

    it('TE-082: all_verified has priority over max_iterations in sync mode', () => {
      const tracker = VerificationTracker.fromIds(['DL-001'])
      tracker.verify('DL-001')
      const state = createStateWithIterations(5)

      const decision = evaluateTermination(
        createContext({
          state,
          verificationTracker: tracker,
          options: {
            maxRetries: 3,
            maxIterations: 5,
            useSyncTermination: true,
          },
        }),
      )

      expect(decision).toEqual({
        action: 'terminate',
        exitReason: 'all_verified',
      })
    })

    it('TE-083: ignores all_verified when useSyncTermination is false', () => {
      const tracker = VerificationTracker.fromIds(['DL-001'])
      tracker.verify('DL-001')

      const decision = evaluateTermination(
        createContext({
          verificationTracker: tracker,
          options: { maxRetries: 3, useSyncTermination: false },
        }),
      )

      // Should continue because sync mode is disabled
      expect(decision.action).toBe('continue')
    })
  })
})
