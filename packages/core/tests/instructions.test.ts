import { describe, it, expect } from 'vitest'
import {
  initializerInstruction,
  codingInstruction,
  createDefaultInstructionResolver,
  selectInstruction,
} from '../src/instructions'
import { MockDeliverableStatusReader } from './helpers'

describe('instructions', () => {
  describe('exports', () => {
    it('exports initializerInstruction as non-empty string', () => {
      expect(initializerInstruction).toBeTruthy()
      expect(typeof initializerInstruction).toBe('string')
      expect(initializerInstruction.length).toBeGreaterThan(0)
    })

    it('exports codingInstruction as non-empty string', () => {
      expect(codingInstruction).toBeTruthy()
      expect(typeof codingInstruction).toBe('string')
      expect(codingInstruction.length).toBeGreaterThan(0)
    })

    it('initializerInstruction contains expected content', () => {
      expect(initializerInstruction).toContain('SPEC.md')
      expect(initializerInstruction).toContain('create_deliverable')
    })

    it('codingInstruction contains expected content', () => {
      expect(codingInstruction).toContain('set_deliverable_status')
      expect(codingInstruction).toContain('passed')
    })
  })

  describe('createDefaultInstructionResolver', () => {
    it('returns initializer instruction for initializer name', async () => {
      const resolver = createDefaultInstructionResolver()
      const instruction = await resolver.resolve('initializer')
      expect(instruction).toBe(initializerInstruction)
    })

    it('returns coding instruction for coding name', async () => {
      const resolver = createDefaultInstructionResolver()
      const instruction = await resolver.resolve('coding')
      expect(instruction).toBe(codingInstruction)
    })
  })

  describe('selectInstruction', () => {
    it('SC-S002: returns initializer when status.json does not exist', async () => {
      const statusReader = new MockDeliverableStatusReader()
      // Empty sequence means exists() returns false
      const resolver = createDefaultInstructionResolver()

      const instruction = await selectInstruction(statusReader, resolver)
      expect(instruction).toBe(initializerInstruction)
    })

    it('returns coding instruction when status.json exists', async () => {
      const statusReader = new MockDeliverableStatusReader()
      // Setting any status makes exists() return true
      statusReader.setStatusSequence([{ deliverables: [] }])
      const resolver = createDefaultInstructionResolver()

      const instruction = await selectInstruction(statusReader, resolver)
      expect(instruction).toBe(codingInstruction)
    })
  })
})
