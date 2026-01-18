import { describe, it, expect } from 'vitest'
import {
  initializerInstruction,
  codingInstruction,
  syncInstruction,
  verifyInstruction,
  defaultInstructions,
  createDefaultInstructionResolver,
} from '../src/instructions'

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
      expect(initializerInstruction).toContain('mcp__autonoe__create')
    })

    it('codingInstruction contains expected content', () => {
      expect(codingInstruction).toContain('mcp__autonoe__set_status')
      expect(codingInstruction).toContain('passed')
    })
  })

  describe('defaultInstructions', () => {
    it('contains all instruction types', () => {
      expect(defaultInstructions.initializer).toBe(initializerInstruction)
      expect(defaultInstructions.coding).toBe(codingInstruction)
      expect(defaultInstructions.sync).toBe(syncInstruction)
      expect(defaultInstructions.verify).toBe(verifyInstruction)
    })

    it('has exactly 4 instruction types', () => {
      expect(Object.keys(defaultInstructions)).toHaveLength(4)
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

    it('returns sync instruction for sync name', async () => {
      const resolver = createDefaultInstructionResolver()
      const instruction = await resolver.resolve('sync')
      expect(instruction).toBe(syncInstruction)
    })

    it('returns verify instruction for verify name', async () => {
      const resolver = createDefaultInstructionResolver()
      const instruction = await resolver.resolve('verify')
      expect(instruction).toBe(verifyInstruction)
    })
  })
})
