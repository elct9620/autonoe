import { describe, it, expect, vi } from 'vitest'
import {
  DefaultInstructionSelector,
  createInstructionSelector,
} from '../src/instructionSelector'
import { Workflow } from '../src/workflow'
import type { InstructionSelectionContext } from '../src/instructionSelector'
import type { InstructionResolver } from '../src/instructions'
import type { DeliverableStatusReader } from '../src/deliverableStatus'

function createMockResolver(
  content: string = 'test content',
): InstructionResolver {
  return {
    resolve: vi.fn().mockResolvedValue(content),
  }
}

function createMockStatusReader(exists: boolean): DeliverableStatusReader {
  return {
    exists: vi.fn().mockResolvedValue(exists),
    load: vi.fn(),
  }
}

function createContext(
  iteration: number,
  statusExists: boolean,
): InstructionSelectionContext {
  return {
    iteration,
    statusReader: createMockStatusReader(statusExists),
  }
}

describe('DefaultInstructionSelector', () => {
  it('selects initializer when status.json does not exist', async () => {
    const resolver = createMockResolver('initializer content')
    const selector = new DefaultInstructionSelector(resolver)
    const context = createContext(1, false)

    const result = await selector.select(context)

    expect(result.name).toBe('initializer')
    expect(result.content).toBe('initializer content')
    expect(resolver.resolve).toHaveBeenCalledWith('initializer')
  })

  it('selects coding when status.json exists', async () => {
    const resolver = createMockResolver('coding content')
    const selector = new DefaultInstructionSelector(resolver)
    const context = createContext(1, true)

    const result = await selector.select(context)

    expect(result.name).toBe('coding')
    expect(result.content).toBe('coding content')
    expect(resolver.resolve).toHaveBeenCalledWith('coding')
  })
})

describe('createInstructionSelector', () => {
  describe('with run workflow', () => {
    it('selects initializer when isFirstSession returns true', async () => {
      const resolver = createMockResolver('initializer content')
      const selector = createInstructionSelector(
        Workflow.run,
        resolver,
        async () => true,
      )
      const context = createContext(1, false)

      const result = await selector.select(context)

      expect(result.name).toBe('initializer')
      expect(result.content).toBe('initializer content')
    })

    it('selects coding when isFirstSession returns false', async () => {
      const resolver = createMockResolver('coding content')
      const selector = createInstructionSelector(
        Workflow.run,
        resolver,
        async () => false,
      )
      const context = createContext(2, true)

      const result = await selector.select(context)

      expect(result.name).toBe('coding')
      expect(result.content).toBe('coding content')
    })
  })

  describe('with sync workflow', () => {
    it('selects sync when isFirstSession returns true', async () => {
      const resolver = createMockResolver('sync content')
      const selector = createInstructionSelector(
        Workflow.sync,
        resolver,
        async (ctx) => ctx.iteration === 1,
      )
      const context = createContext(1, true)

      const result = await selector.select(context)

      expect(result.name).toBe('sync')
      expect(result.content).toBe('sync content')
    })

    it('selects verify when isFirstSession returns false', async () => {
      const resolver = createMockResolver('verify content')
      const selector = createInstructionSelector(
        Workflow.sync,
        resolver,
        async (ctx) => ctx.iteration === 1,
      )
      const context = createContext(2, true)

      const result = await selector.select(context)

      expect(result.name).toBe('verify')
      expect(result.content).toBe('verify content')
    })
  })

  it('passes context to isFirstSession predicate', async () => {
    const resolver = createMockResolver()
    const isFirstSession = vi.fn().mockResolvedValue(true)
    const selector = createInstructionSelector(
      Workflow.run,
      resolver,
      isFirstSession,
    )
    const context = createContext(5, true)

    await selector.select(context)

    expect(isFirstSession).toHaveBeenCalledWith(context)
  })
})
