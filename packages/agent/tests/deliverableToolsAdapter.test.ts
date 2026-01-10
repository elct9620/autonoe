import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  Deliverable,
  DeliverableStatus,
  type DeliverableRepository,
  type DeliverableStatusNotification,
} from '@autonoe/core'
import {
  handleCreateDeliverables,
  handleSetDeliverableStatus,
  createDeliverableMcpServer,
} from '../src/deliverableToolsAdapter'

/**
 * Mock implementation of DeliverableRepository for testing
 */
class MockDeliverableRepository implements DeliverableRepository {
  private status: DeliverableStatus = DeliverableStatus.create(
    '2025-01-01',
    '2025-01-01',
    [],
  )
  public loadCalls = 0
  public saveCalls = 0
  public savedStatus: DeliverableStatus | undefined

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
    this.status = DeliverableStatus.create('2025-01-01', '2025-01-01', [])
    this.loadCalls = 0
    this.saveCalls = 0
    this.savedStatus = undefined
  }
}

describe('deliverableToolsAdapter', () => {
  let repository: MockDeliverableRepository

  beforeEach(() => {
    repository = new MockDeliverableRepository()
  })

  describe('handleCreateDeliverables', () => {
    describe('DL-T001: Valid deliverable input', () => {
      it('adds single deliverable to status and saves', async () => {
        const input = {
          deliverables: [
            {
              id: 'DL-001',
              description: 'User Authentication',
              acceptanceCriteria: ['User can login', 'User can logout'],
            },
          ],
        }

        const result = await handleCreateDeliverables(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(1)

        // Verify saved status
        expect(repository.savedStatus).not.toBeNull()
        expect(repository.savedStatus!.deliverables).toHaveLength(1)
        expect(repository.savedStatus!.deliverables[0]).toMatchObject({
          id: 'DL-001',
          description: 'User Authentication',
          acceptanceCriteria: ['User can login', 'User can logout'],
          passed: false,
          blocked: false,
        })

        // Verify result format
        expect(result.content).toHaveLength(1)
        expect(result.content[0]?.type).toBe('text')

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
        expect(parsedResult.message).toContain('1 deliverable')
      })

      it('adds multiple deliverables in batch', async () => {
        const input = {
          deliverables: [
            {
              id: 'DL-001',
              description: 'First Feature',
              acceptanceCriteria: ['AC1'],
            },
            {
              id: 'DL-002',
              description: 'Second Feature',
              acceptanceCriteria: ['AC2'],
            },
          ],
        }

        const result = await handleCreateDeliverables(repository, input)

        // Verify saved status
        expect(repository.savedStatus!.deliverables).toHaveLength(2)
        expect(repository.savedStatus!.deliverables[0]!.id).toBe('DL-001')
        expect(repository.savedStatus!.deliverables[1]!.id).toBe('DL-002')

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
        expect(parsedResult.message).toContain('2 deliverable')
      })
    })

    describe('DL-T002: Duplicate deliverable ID', () => {
      it('returns error for duplicate in existing status and does not save', async () => {
        // Setup existing deliverable
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Existing', ['AC1']),
          ]),
        )

        const input = {
          deliverables: [
            {
              id: 'DL-001',
              description: 'Duplicate',
              acceptanceCriteria: ['AC2'],
            },
          ],
        }

        const result = await handleCreateDeliverables(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(0) // Should NOT save on error

        // Verify result
        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(false)
        expect(parsedResult.message).toContain('already exists')
      })

      it('returns error for duplicate within batch', async () => {
        const input = {
          deliverables: [
            {
              id: 'DL-001',
              description: 'First',
              acceptanceCriteria: ['AC1'],
            },
            {
              id: 'DL-001',
              description: 'Duplicate',
              acceptanceCriteria: ['AC2'],
            },
          ],
        }

        const result = await handleCreateDeliverables(repository, input)

        // Should NOT save on error
        expect(repository.saveCalls).toBe(0)

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(false)
        expect(parsedResult.message).toContain('Duplicate ID')
      })
    })
  })

  describe('handleSetDeliverableStatus', () => {
    describe('DL-T003: status=passed', () => {
      it('updates status.json with passed=true, blocked=false', async () => {
        // Setup existing deliverable
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Feature', ['AC1']),
          ]),
        )

        const input = {
          deliverableId: 'DL-001',
          status: 'passed' as const,
        }

        const result = await handleSetDeliverableStatus(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(1)

        // Verify saved status
        expect(repository.savedStatus).not.toBeNull()
        expect(repository.savedStatus?.deliverables[0]?.passed).toBe(true)
        expect(repository.savedStatus?.deliverables[0]?.blocked).toBe(false)

        // Verify result
        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
        expect(parsedResult.message).toContain('passed')
      })
    })

    describe('DL-T004: Invalid deliverable ID', () => {
      it('returns error: deliverable not found', async () => {
        // Empty repository
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', []),
        )

        const input = {
          deliverableId: 'DL-999',
          status: 'passed' as const,
        }

        const result = await handleSetDeliverableStatus(repository, input)

        // Verify repository interactions
        expect(repository.loadCalls).toBe(1)
        expect(repository.saveCalls).toBe(0) // Should NOT save on error

        // Verify result
        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(false)
        expect(parsedResult.message).toContain('not found')
      })
    })

    describe('DL-T005: status=blocked', () => {
      it('updates status.json with passed=false, blocked=true', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Feature', ['AC1']),
          ]),
        )

        const input = {
          deliverableId: 'DL-001',
          status: 'blocked' as const,
        }

        const result = await handleSetDeliverableStatus(repository, input)

        expect(repository.saveCalls).toBe(1)
        expect(repository.savedStatus?.deliverables[0]?.passed).toBe(false)
        expect(repository.savedStatus?.deliverables[0]?.blocked).toBe(true)

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
        expect(parsedResult.message).toContain('blocked')
      })
    })

    describe('DL-T006: status=pending', () => {
      it('updates status.json with passed=false, blocked=false', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.passed('DL-001', 'Feature', ['AC1']),
          ]),
        )

        const input = {
          deliverableId: 'DL-001',
          status: 'pending' as const,
        }

        const result = await handleSetDeliverableStatus(repository, input)

        expect(repository.saveCalls).toBe(1)
        expect(repository.savedStatus?.deliverables[0]?.passed).toBe(false)
        expect(repository.savedStatus?.deliverables[0]?.blocked).toBe(false)

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
        expect(parsedResult.message).toContain('pending')
      })
    })

    describe('DL-T007: pending resets blocked state', () => {
      it('resets blocked deliverable to pending', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.blocked('DL-001', 'Feature', ['AC1']),
          ]),
        )

        const input = {
          deliverableId: 'DL-001',
          status: 'pending' as const,
        }

        const result = await handleSetDeliverableStatus(repository, input)

        expect(repository.saveCalls).toBe(1)
        expect(repository.savedStatus?.deliverables[0]?.passed).toBe(false)
        expect(repository.savedStatus?.deliverables[0]?.blocked).toBe(false)

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
      })
    })

    describe('DL-T008: Callback invoked on successful status change', () => {
      it('invokes callback with correct notification data', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'User Authentication', ['AC1']),
          ]),
        )

        const callback = vi.fn()
        const input = {
          deliverableId: 'DL-001',
          status: 'passed' as const,
        }

        await handleSetDeliverableStatus(repository, input, callback)

        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith({
          deliverableId: 'DL-001',
          deliverableDescription: 'User Authentication',
          previousStatus: 'pending',
          newStatus: 'passed',
        } satisfies DeliverableStatusNotification)
      })

      it('reports correct previous status when blocked', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.blocked('DL-001', 'Feature', ['AC1']),
          ]),
        )

        const callback = vi.fn()
        const input = {
          deliverableId: 'DL-001',
          status: 'pending' as const,
        }

        await handleSetDeliverableStatus(repository, input, callback)

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            previousStatus: 'blocked',
            newStatus: 'pending',
          }),
        )
      })
    })

    describe('DL-T009: Callback not invoked on failure', () => {
      it('does not invoke callback when deliverable not found', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', []),
        )

        const callback = vi.fn()
        const input = {
          deliverableId: 'DL-999',
          status: 'passed' as const,
        }

        await handleSetDeliverableStatus(repository, input, callback)

        expect(callback).not.toHaveBeenCalled()
      })
    })
  })

  describe('Tool result format', () => {
    it('returns MCP-compatible content structure', async () => {
      const input = {
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test',
            acceptanceCriteria: ['AC1'],
          },
        ],
      }

      const result = await handleCreateDeliverables(repository, input)

      // Verify MCP content structure
      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type', 'text')
      expect(result.content[0]).toHaveProperty('text')
      expect(typeof result.content[0]?.text).toBe('string')
    })
  })

  describe('createDeliverableMcpServer', () => {
    describe('DL-T010: Server structure', () => {
      it('returns SDK MCP server configuration with required properties', () => {
        const server = createDeliverableMcpServer(repository)

        // McpSdkServerConfigWithInstance has: type, name, instance
        expect(server).toHaveProperty('type', 'sdk')
        expect(server).toHaveProperty('name')
        expect(server).toHaveProperty('instance')
      })
    })

    describe('DL-T011: Server configuration', () => {
      it('has correct server name', () => {
        const server = createDeliverableMcpServer(repository)

        expect(server.name).toBe('autonoe-deliverable')
      })
    })

    describe('DL-T012: Server instance', () => {
      it('provides valid MCP server instance', () => {
        const server = createDeliverableMcpServer(repository)

        // SDK MCP server instance should be a valid object
        expect(server.instance).toBeDefined()
        expect(typeof server.instance).toBe('object')
      })
    })
  })
})
