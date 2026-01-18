import { describe, it, expect } from 'vitest'
import { Workflow, SYNC_FIRST_SESSION } from '../src/workflow'

describe('Workflow', () => {
  describe('static instances', () => {
    it('run workflow has initializer and coding instructions', () => {
      expect(Workflow.run.type).toBe('run')
      expect(Workflow.run.planningInstruction).toBe('initializer')
      expect(Workflow.run.implementationInstruction).toBe('coding')
    })

    it('sync workflow has sync and verify instructions', () => {
      expect(Workflow.sync.type).toBe('sync')
      expect(Workflow.sync.planningInstruction).toBe('sync')
      expect(Workflow.sync.implementationInstruction).toBe('verify')
    })
  })

  describe('fromType', () => {
    it('returns run workflow for run type', () => {
      expect(Workflow.fromType('run')).toBe(Workflow.run)
    })

    it('returns sync workflow for sync type', () => {
      expect(Workflow.fromType('sync')).toBe(Workflow.sync)
    })
  })

  describe('isPlanningInstruction', () => {
    it('returns true for planning instructions', () => {
      expect(Workflow.run.isPlanningInstruction('initializer')).toBe(true)
      expect(Workflow.sync.isPlanningInstruction('sync')).toBe(true)
    })

    it('returns false for implementation instructions', () => {
      expect(Workflow.run.isPlanningInstruction('coding')).toBe(false)
      expect(Workflow.sync.isPlanningInstruction('verify')).toBe(false)
    })
  })

  describe('getPhaseType', () => {
    it('returns planning for planning instructions', () => {
      expect(Workflow.run.getPhaseType('initializer')).toBe('planning')
      expect(Workflow.sync.getPhaseType('sync')).toBe('planning')
    })

    it('returns implementation for implementation instructions', () => {
      expect(Workflow.run.getPhaseType('coding')).toBe('implementation')
      expect(Workflow.sync.getPhaseType('verify')).toBe('implementation')
    })
  })

  describe('SYNC_FIRST_SESSION', () => {
    it('equals 1', () => {
      expect(SYNC_FIRST_SESSION).toBe(1)
    })
  })
})
