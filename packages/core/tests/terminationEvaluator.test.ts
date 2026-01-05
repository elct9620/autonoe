import { describe, it, expect, vi } from 'vitest'
import {
  InterruptedEvaluator,
  QuotaExceededEvaluator,
  AllPassedEvaluator,
  AllBlockedEvaluator,
  MaxIterationsEvaluator,
  MaxRetriesEvaluator,
  TerminationChain,
  createDefaultTerminationChain,
  type TerminationContext,
} from '../src/terminationEvaluator'
import { createInitialLoopState } from '../src/loopState'
import { ExitReason } from '../src/sessionRunner'
import { SessionOutcome } from '../src/types'
import type { DeliverableStatus } from '../src/deliverableStatus'

/**
 * TerminationEvaluator Tests
 * Tests for the Strategy pattern termination evaluators
 */

function createContext(
  overrides: Partial<TerminationContext> = {},
): TerminationContext {
  return {
    state: createInitialLoopState(),
    options: { maxRetries: 3 },
    ...overrides,
  }
}

describe('InterruptedEvaluator', () => {
  const evaluator = new InterruptedEvaluator()

  it('TE-001: returns shouldTerminate when signal is aborted', () => {
    const controller = new AbortController()
    controller.abort()

    const decision = evaluator.evaluate(
      createContext({ signal: controller.signal }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.Interrupted)
  })

  it('TE-002: returns shouldNotTerminate when signal is not aborted', () => {
    const controller = new AbortController()

    const decision = evaluator.evaluate(
      createContext({ signal: controller.signal }),
    )

    expect(decision.shouldTerminate).toBe(false)
  })

  it('TE-003: returns shouldNotTerminate when no signal provided', () => {
    const decision = evaluator.evaluate(createContext())

    expect(decision.shouldTerminate).toBe(false)
  })
})

describe('QuotaExceededEvaluator', () => {
  const evaluator = new QuotaExceededEvaluator()

  it('TE-010: returns shouldTerminate when quota exceeded without waitForQuota', () => {
    const decision = evaluator.evaluate(
      createContext({
        sessionOutcome: SessionOutcome.QuotaExceeded,
        options: { maxRetries: 3, waitForQuota: false },
      }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.QuotaExceeded)
  })

  it('TE-011: returns waitDuration when quota exceeded with waitForQuota', () => {
    const futureTime = new Date(Date.now() + 60000) // 1 minute from now

    const decision = evaluator.evaluate(
      createContext({
        sessionOutcome: SessionOutcome.QuotaExceeded,
        quotaResetTime: futureTime,
        options: { maxRetries: 3, waitForQuota: true },
      }),
    )

    expect(decision.shouldTerminate).toBe(false)
    expect(decision.waitDuration).toBeGreaterThan(0)
  })

  it('TE-012: returns shouldNotTerminate when outcome is not quota exceeded', () => {
    const decision = evaluator.evaluate(
      createContext({
        sessionOutcome: SessionOutcome.Completed,
      }),
    )

    expect(decision.shouldTerminate).toBe(false)
  })
})

describe('AllPassedEvaluator', () => {
  const evaluator = new AllPassedEvaluator()

  it('TE-020: returns shouldTerminate when all deliverables passed', () => {
    const status: DeliverableStatus = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliverables: [
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
      ],
    }

    const decision = evaluator.evaluate(
      createContext({ deliverableStatus: status }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.AllPassed)
  })

  it('TE-021: returns shouldTerminate when achievable deliverables passed (some blocked)', () => {
    const status: DeliverableStatus = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliverables: [
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
      ],
    }

    const decision = evaluator.evaluate(
      createContext({ deliverableStatus: status }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.AllPassed)
  })

  it('TE-022: returns shouldNotTerminate when not all deliverables passed', () => {
    const status: DeliverableStatus = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliverables: [
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
      ],
    }

    const decision = evaluator.evaluate(
      createContext({ deliverableStatus: status }),
    )

    expect(decision.shouldTerminate).toBe(false)
  })

  it('TE-023: returns shouldNotTerminate when no deliverable status', () => {
    const decision = evaluator.evaluate(createContext())

    expect(decision.shouldTerminate).toBe(false)
  })
})

describe('AllBlockedEvaluator', () => {
  const evaluator = new AllBlockedEvaluator()

  it('TE-030: returns shouldTerminate when all deliverables blocked', () => {
    const status: DeliverableStatus = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliverables: [
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
      ],
    }

    const decision = evaluator.evaluate(
      createContext({ deliverableStatus: status }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.AllBlocked)
  })

  it('TE-031: returns shouldNotTerminate when not all blocked', () => {
    const status: DeliverableStatus = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliverables: [
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
      ],
    }

    const decision = evaluator.evaluate(
      createContext({ deliverableStatus: status }),
    )

    expect(decision.shouldTerminate).toBe(false)
  })
})

describe('MaxIterationsEvaluator', () => {
  const evaluator = new MaxIterationsEvaluator()

  it('TE-040: returns shouldTerminate when max iterations reached', () => {
    const state = { ...createInitialLoopState(), iterations: 5 }

    const decision = evaluator.evaluate(
      createContext({
        state,
        options: { maxRetries: 3, maxIterations: 5 },
      }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.MaxIterations)
  })

  it('TE-041: returns shouldNotTerminate when below max iterations', () => {
    const state = { ...createInitialLoopState(), iterations: 3 }

    const decision = evaluator.evaluate(
      createContext({
        state,
        options: { maxRetries: 3, maxIterations: 5 },
      }),
    )

    expect(decision.shouldTerminate).toBe(false)
  })

  it('TE-042: returns shouldNotTerminate when maxIterations not set', () => {
    const state = { ...createInitialLoopState(), iterations: 100 }

    const decision = evaluator.evaluate(
      createContext({
        state,
        options: { maxRetries: 3 },
      }),
    )

    expect(decision.shouldTerminate).toBe(false)
  })
})

describe('MaxRetriesEvaluator', () => {
  const evaluator = new MaxRetriesEvaluator()

  it('TE-050: returns shouldTerminate when consecutive errors exceed max retries', () => {
    const state = { ...createInitialLoopState(), consecutiveErrors: 4 }

    const decision = evaluator.evaluate(
      createContext({
        state,
        options: { maxRetries: 3 },
      }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.MaxRetriesExceeded)
  })

  it('TE-051: returns shouldNotTerminate when errors at max retries', () => {
    const state = { ...createInitialLoopState(), consecutiveErrors: 3 }

    const decision = evaluator.evaluate(
      createContext({
        state,
        options: { maxRetries: 3 },
      }),
    )

    expect(decision.shouldTerminate).toBe(false)
  })

  it('TE-052: returns shouldNotTerminate when no errors', () => {
    const decision = evaluator.evaluate(createContext())

    expect(decision.shouldTerminate).toBe(false)
  })
})

describe('TerminationChain', () => {
  it('TE-060: returns first termination decision', () => {
    const chain = new TerminationChain([
      new InterruptedEvaluator(),
      new MaxIterationsEvaluator(),
    ])

    const controller = new AbortController()
    controller.abort()

    const decision = chain.evaluate(
      createContext({
        signal: controller.signal,
        options: { maxRetries: 3, maxIterations: 1 },
      }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.Interrupted)
  })

  it('TE-061: continues to next evaluator when first returns shouldNotTerminate', () => {
    const chain = new TerminationChain([
      new InterruptedEvaluator(),
      new MaxIterationsEvaluator(),
    ])

    const state = { ...createInitialLoopState(), iterations: 5 }

    const decision = chain.evaluate(
      createContext({
        state,
        options: { maxRetries: 3, maxIterations: 5 },
      }),
    )

    expect(decision.shouldTerminate).toBe(true)
    expect(decision.exitReason).toBe(ExitReason.MaxIterations)
  })

  it('TE-062: returns shouldNotTerminate when no evaluator triggers', () => {
    const chain = new TerminationChain([
      new InterruptedEvaluator(),
      new MaxIterationsEvaluator(),
    ])

    const decision = chain.evaluate(createContext())

    expect(decision.shouldTerminate).toBe(false)
  })

  it('TE-063: returns wait duration when evaluator returns it', () => {
    const chain = new TerminationChain([new QuotaExceededEvaluator()])

    const futureTime = new Date(Date.now() + 60000)

    const decision = chain.evaluate(
      createContext({
        sessionOutcome: SessionOutcome.QuotaExceeded,
        quotaResetTime: futureTime,
        options: { maxRetries: 3, waitForQuota: true },
      }),
    )

    expect(decision.shouldTerminate).toBe(false)
    expect(decision.waitDuration).toBeGreaterThan(0)
  })
})

describe('createDefaultTerminationChain', () => {
  it('TE-070: creates chain with correct priority order', () => {
    const chain = createDefaultTerminationChain()

    // Test that Interrupted has highest priority
    const controller = new AbortController()
    controller.abort()

    const state = { ...createInitialLoopState(), iterations: 5 }
    const status: DeliverableStatus = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliverables: [
        {
          id: 'd1',
          description: 'Task',
          acceptanceCriteria: ['Done'],
          passed: true,
          blocked: false,
        },
      ],
    }

    const decision = chain.evaluate(
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
})
