import { describe, it, expect } from 'vitest'
import {
  evaluateTermination,
  type TerminationContext,
} from '../src/terminationEvaluator'
import { LoopState } from '../src/loopState'
import { ExitReason } from '../src/sessionRunner'
import { DeliverableStatus } from '../src/deliverableStatus'

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
    it('TE-001: returns shouldTerminate when signal is aborted', () => {
      const controller = new AbortController()
      controller.abort()

      const decision = evaluateTermination(
        createContext({ signal: controller.signal }),
      )

      expect(decision.shouldTerminate).toBe(true)
      expect(decision.exitReason).toBe(ExitReason.Interrupted)
    })

    it('TE-002: returns shouldNotTerminate when signal is not aborted', () => {
      const controller = new AbortController()

      const decision = evaluateTermination(
        createContext({ signal: controller.signal }),
      )

      expect(decision.shouldTerminate).toBe(false)
    })

    it('TE-003: returns shouldNotTerminate when no signal provided', () => {
      const decision = evaluateTermination(createContext())

      expect(decision.shouldTerminate).toBe(false)
    })
  })

  describe('Quota exceeded condition', () => {
    it('TE-010: returns shouldTerminate when quota exceeded without waitForQuota', () => {
      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'quota_exceeded',
          options: { maxRetries: 3, waitForQuota: false },
        }),
      )

      expect(decision.shouldTerminate).toBe(true)
      expect(decision.exitReason).toBe(ExitReason.QuotaExceeded)
    })

    it('TE-011: returns waitDuration when quota exceeded with waitForQuota', () => {
      const futureTime = new Date(Date.now() + 60000) // 1 minute from now

      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'quota_exceeded',
          quotaResetTime: futureTime,
          options: { maxRetries: 3, waitForQuota: true },
        }),
      )

      expect(decision.shouldTerminate).toBe(false)
      expect(decision.waitDuration).toBeGreaterThan(0)
    })

    it('TE-012: returns shouldNotTerminate when outcome is not quota exceeded', () => {
      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'completed',
        }),
      )

      expect(decision.shouldTerminate).toBe(false)
    })
  })

  describe('All passed condition', () => {
    it('TE-020: returns shouldTerminate when all deliverables passed', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task 1',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
        {
          id: 'd2',
          description: 'Task 2',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision.shouldTerminate).toBe(true)
      expect(decision.exitReason).toBe(ExitReason.AllPassed)
    })

    it('TE-021: returns shouldTerminate when achievable deliverables passed (some blocked)', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task 1',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
        {
          id: 'd2',
          description: 'Task 2',
          acceptanceCriteria: ['Done'],
          passed: false,
          blocked: true,
        },
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision.shouldTerminate).toBe(true)
      expect(decision.exitReason).toBe(ExitReason.AllPassed)
    })

    it('TE-022: returns shouldNotTerminate when not all deliverables passed', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task 1',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
        {
          id: 'd2',
          description: 'Task 2',
          acceptanceCriteria: ['Done'],
          passed: false,
          blocked: false,
        },
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision.shouldTerminate).toBe(false)
    })

    it('TE-023: returns shouldNotTerminate when no deliverable status', () => {
      const decision = evaluateTermination(createContext())

      expect(decision.shouldTerminate).toBe(false)
    })
  })

  describe('All blocked condition', () => {
    it('TE-030: returns shouldTerminate when all deliverables blocked', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task 1',
          acceptanceCriteria: ['Done'],
          passed: false,
          blocked: true,
        },
        {
          id: 'd2',
          description: 'Task 2',
          acceptanceCriteria: ['Done'],
          passed: false,
          blocked: true,
        },
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision.shouldTerminate).toBe(true)
      expect(decision.exitReason).toBe(ExitReason.AllBlocked)
    })

    it('TE-031: returns shouldNotTerminate when not all blocked', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task 1',
          acceptanceCriteria: ['Done'],
          passed: false,
          blocked: true,
        },
        {
          id: 'd2',
          description: 'Task 2',
          acceptanceCriteria: ['Done'],
          passed: false,
          blocked: false,
        },
      ])

      const decision = evaluateTermination(
        createContext({ deliverableStatus: status }),
      )

      expect(decision.shouldTerminate).toBe(false)
    })
  })

  describe('Max iterations condition', () => {
    it('TE-040: returns shouldTerminate when max iterations reached', () => {
      const state = createStateWithIterations(5)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3, maxIterations: 5 },
        }),
      )

      expect(decision.shouldTerminate).toBe(true)
      expect(decision.exitReason).toBe(ExitReason.MaxIterations)
    })

    it('TE-041: returns shouldNotTerminate when below max iterations', () => {
      const state = createStateWithIterations(3)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3, maxIterations: 5 },
        }),
      )

      expect(decision.shouldTerminate).toBe(false)
    })

    it('TE-042: returns shouldNotTerminate when maxIterations not set', () => {
      const state = createStateWithIterations(100)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3 },
        }),
      )

      expect(decision.shouldTerminate).toBe(false)
    })
  })

  describe('Max retries condition', () => {
    it('TE-050: returns shouldTerminate when consecutive errors exceed max retries', () => {
      const state = createStateWithErrors(4)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3 },
        }),
      )

      expect(decision.shouldTerminate).toBe(true)
      expect(decision.exitReason).toBe(ExitReason.MaxRetriesExceeded)
    })

    it('TE-051: returns shouldNotTerminate when errors at max retries', () => {
      const state = createStateWithErrors(3)

      const decision = evaluateTermination(
        createContext({
          state,
          options: { maxRetries: 3 },
        }),
      )

      expect(decision.shouldTerminate).toBe(false)
    })

    it('TE-052: returns shouldNotTerminate when no errors', () => {
      const decision = evaluateTermination(createContext())

      expect(decision.shouldTerminate).toBe(false)
    })
  })

  describe('Priority order', () => {
    it('TE-070: Interrupted has highest priority over other conditions', () => {
      const controller = new AbortController()
      controller.abort()

      const state = createStateWithIterations(5)
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
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
      expect(decision.exitReason).toBe(ExitReason.Interrupted)
    })

    it('TE-071: QuotaExceeded has priority over AllPassed', () => {
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
      ])

      const decision = evaluateTermination(
        createContext({
          sessionOutcome: 'quota_exceeded',
          deliverableStatus: status,
          options: { maxRetries: 3, waitForQuota: false },
        }),
      )

      expect(decision.exitReason).toBe(ExitReason.QuotaExceeded)
    })

    it('TE-072: AllPassed has priority over MaxIterations', () => {
      const state = createStateWithIterations(5)
      const now = new Date().toISOString()
      const status = DeliverableStatus.create(now, now, [
        {
          id: 'd1',
          description: 'Task',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
      ])

      const decision = evaluateTermination(
        createContext({
          state,
          deliverableStatus: status,
          options: { maxRetries: 3, maxIterations: 5 },
        }),
      )

      expect(decision.exitReason).toBe(ExitReason.AllPassed)
    })
  })
})
