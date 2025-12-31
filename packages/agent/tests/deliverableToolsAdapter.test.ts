import { describe, it, expect, beforeEach } from 'vitest'
import type { DeliverableRepository, DeliverableStatus } from '@autonoe/core'
import {
  handleCreateDeliverable,
  handleUpdateDeliverable,
} from '../src/deliverableToolsAdapter'

/**
 * Mock implementation of DeliverableRepository for testing
 */
class MockDeliverableRepository implements DeliverableRepository {
  private status: DeliverableStatus = { deliverables: [] }
  public loadCalls = 0
  public saveCalls = 0
  public savedStatus: DeliverableStatus | null = null

  setStatus(status: DeliverableStatus): void {
    this.status = status
  }

  async exists(): Promise<boolean> {
    return this.status.deliverables.length > 0
  }

  async load(): Promise<DeliverableStatus> {
    this.loadCalls++
    return this.status
  }

  async save(status: DeliverableStatus): Promise<void> {
    this.saveCalls++
    this.savedStatus = status
    this.status = status
  }

  reset(): void {
    this.status = { deliverables: [] }
    this.loadCalls = 0
    this.saveCalls = 0
    this.savedStatus = null
  }
}

describe('deliverableToolsAdapter', () => {
  let repository: MockDeliverableRepository

  beforeEach(() => {
    repository = new MockDeliverableRepository()
  })

  describe('handleCreateDeliverable', () => {
    describe('DL-T001: Valid deliverable input', () => {
      it('adds deliverable to status and saves', async () => {
        const input = {
          id: 'DL-001',
          name: 'User Authentication',
          acceptanceCriteria: ['User can login', 'User can logout'],
        }

        const result = await handleCreateDeliverable(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(1)

        // Verify saved status
        expect(repository.savedStatus).not.toBeNull()
        expect(repository.savedStatus!.deliverables).toHaveLength(1)
        expect(repository.savedStatus!.deliverables[0]).toMatchObject({
          id: 'DL-001',
          name: 'User Authentication',
          acceptanceCriteria: ['User can login', 'User can logout'],
          passed: false,
        })

        // Verify result format
        expect(result.content).toHaveLength(1)
        expect(result.content[0]?.type).toBe('text')

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
      })
    })

    describe('DL-T002: Duplicate deliverable ID', () => {
      it('returns error and does not save', async () => {
        // Setup existing deliverable
        repository.setStatus({
          deliverables: [
            {
              id: 'DL-001',
              name: 'Existing',
              acceptanceCriteria: ['AC1'],
              passed: false,
            },
          ],
        })

        const input = {
          id: 'DL-001',
          name: 'Duplicate',
          acceptanceCriteria: ['AC2'],
        }

        const result = await handleCreateDeliverable(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(0) // Should NOT save on error

        // Verify result
        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(false)
        expect(parsedResult.message).toContain('already exists')
      })
    })
  })

  describe('handleUpdateDeliverable', () => {
    describe('DL-T003: Valid ID, passed=true', () => {
      it('updates status.json with passed=true', async () => {
        // Setup existing deliverable
        repository.setStatus({
          deliverables: [
            {
              id: 'DL-001',
              name: 'Feature',
              acceptanceCriteria: ['AC1'],
              passed: false,
            },
          ],
        })

        const input = {
          deliverableId: 'DL-001',
          passed: true,
        }

        const result = await handleUpdateDeliverable(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(1)

        // Verify saved status
        expect(repository.savedStatus).not.toBeNull()
        expect(repository.savedStatus?.deliverables[0]?.passed).toBe(true)

        // Verify result
        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
        expect(parsedResult.message).toContain('passed')
      })
    })

    describe('DL-T004: Invalid deliverable ID', () => {
      it('returns error: deliverable not found', async () => {
        // Empty repository
        repository.setStatus({ deliverables: [] })

        const input = {
          deliverableId: 'DL-999',
          passed: true,
        }

        const result = await handleUpdateDeliverable(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(0) // Should NOT save on error

        // Verify result
        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(false)
        expect(parsedResult.message).toContain('not found')
      })
    })
  })

  describe('Tool result format', () => {
    it('returns MCP-compatible content structure', async () => {
      const input = {
        id: 'DL-001',
        name: 'Test',
        acceptanceCriteria: ['AC1'],
      }

      const result = await handleCreateDeliverable(repository, input)

      // Verify MCP content structure
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0]).toHaveProperty('text')
      expect(typeof result.content[0]?.text).toBe('string')
    })
  })
})
