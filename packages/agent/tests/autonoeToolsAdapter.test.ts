import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  Deliverable,
  DeliverableStatus,
  VerificationTracker,
  type DeliverableRepository,
  type DeliverableStatusNotification,
} from '@autonoe/core'
import {
  handleCreateDeliverables,
  handleSetDeliverableStatus,
  handleDeprecateDeliverable,
  handleVerifyDeliverable,
  handleListDeliverables,
  createDeliverableMcpServer,
  DELIVERABLE_TOOL_SETS,
} from '../src/autonoeToolsAdapter'

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

describe('autonoeToolsAdapter', () => {
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

  describe('handleDeprecateDeliverable', () => {
    it('marks deliverable as deprecated and saves', async () => {
      repository.setStatus(
        DeliverableStatus.create('2025-01-01', '2025-01-01', [
          Deliverable.pending('DL-001', 'Feature', ['AC1']),
        ]),
      )

      const input = { deliverableId: 'DL-001' }
      const result = await handleDeprecateDeliverable(repository, input)

      expect(repository.loadCalls).toBe(1)
      expect(repository.saveCalls).toBe(1)
      expect(repository.savedStatus?.deliverables[0]?.deprecated).toBe(true)

      const parsedResult = JSON.parse(result.content[0]?.text ?? '')
      expect(parsedResult.success).toBe(true)
      expect(parsedResult.message).toContain('deprecated')
    })

    it('returns error for non-existent deliverable and does not save', async () => {
      repository.setStatus(
        DeliverableStatus.create('2025-01-01', '2025-01-01', []),
      )

      const input = { deliverableId: 'DL-999' }
      const result = await handleDeprecateDeliverable(repository, input)

      expect(repository.saveCalls).toBe(0)

      const parsedResult = JSON.parse(result.content[0]?.text ?? '')
      expect(parsedResult.success).toBe(false)
      expect(parsedResult.message).toContain('not found')
    })

    it('returns error for already deprecated deliverable', async () => {
      repository.setStatus(
        DeliverableStatus.create('2025-01-01', '2025-01-01', [
          Deliverable.create(
            'DL-001',
            'Already Deprecated',
            ['AC1'],
            false,
            false,
            '2025-01-10',
          ),
        ]),
      )

      const input = { deliverableId: 'DL-001' }
      const result = await handleDeprecateDeliverable(repository, input)

      expect(repository.saveCalls).toBe(0)

      const parsedResult = JSON.parse(result.content[0]?.text ?? '')
      expect(parsedResult.success).toBe(false)
      expect(parsedResult.message).toContain('already deprecated')
    })
  })

  describe('handleVerifyDeliverable', () => {
    describe('DL-T010: Valid ID in tracker', () => {
      it('marks deliverable as verified when ID exists in tracker', async () => {
        const tracker = VerificationTracker.fromIds(['DL-001', 'DL-002'])
        const input = { deliverableId: 'DL-001' }

        const result = await handleVerifyDeliverable(tracker, input)

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(true)
        expect(parsedResult.message).toContain('marked as verified')
        expect(tracker.isVerified('DL-001')).toBe(true)
      })
    })

    describe('DL-T011: Invalid ID (not in tracker)', () => {
      it('returns error when deliverable ID not in tracker', async () => {
        const tracker = VerificationTracker.fromIds(['DL-001'])
        const input = { deliverableId: 'DL-999' }

        const result = await handleVerifyDeliverable(tracker, input)

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.success).toBe(false)
        expect(parsedResult.message).toContain('not found')
        expect(tracker.isVerified('DL-999')).toBe(false)
      })
    })
  })

  describe('handleListDeliverables', () => {
    describe('DL-T020: filter: status=pending', () => {
      it('filters by status = pending', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Pending Feature', ['AC1']),
            Deliverable.passed('DL-002', 'Passed Feature', ['AC2']),
            Deliverable.blocked('DL-003', 'Blocked Feature', ['AC3']),
          ]),
        )

        const result = await handleListDeliverables(repository, undefined, {
          filter: { status: 'pending' },
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(1)
        expect(parsedResult.deliverables[0].id).toBe('DL-001')
      })
    })

    describe('DL-T021: filter: status=passed', () => {
      it('filters by status = passed', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Pending Feature', ['AC1']),
            Deliverable.passed('DL-002', 'Passed Feature', ['AC2']),
            Deliverable.blocked('DL-003', 'Blocked Feature', ['AC3']),
          ]),
        )

        const result = await handleListDeliverables(repository, undefined, {
          filter: { status: 'passed' },
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(1)
        expect(parsedResult.deliverables[0].id).toBe('DL-002')
      })
    })

    describe('DL-T022: filter: status=blocked', () => {
      it('filters by status = blocked', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Pending Feature', ['AC1']),
            Deliverable.passed('DL-002', 'Passed Feature', ['AC2']),
            Deliverable.blocked('DL-003', 'Blocked Feature', ['AC3']),
          ]),
        )

        const result = await handleListDeliverables(repository, undefined, {
          filter: { status: 'blocked' },
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(1)
        expect(parsedResult.deliverables[0].id).toBe('DL-003')
      })
    })

    describe('DL-T023: filter: verified=true with tracker', () => {
      it('filters by verified = true with tracker', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'First', ['AC1']),
            Deliverable.pending('DL-002', 'Second', ['AC2']),
          ]),
        )

        const tracker = VerificationTracker.fromIds(['DL-001', 'DL-002'])
        tracker.verify('DL-001')

        const result = await handleListDeliverables(repository, tracker, {
          filter: { verified: true },
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(1)
        expect(parsedResult.deliverables[0].id).toBe('DL-001')
      })
    })

    describe('DL-T024: filter: verified=false with tracker', () => {
      it('filters by verified = false with tracker', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'First', ['AC1']),
            Deliverable.pending('DL-002', 'Second', ['AC2']),
          ]),
        )

        const tracker = VerificationTracker.fromIds(['DL-001', 'DL-002'])
        tracker.verify('DL-001')

        const result = await handleListDeliverables(repository, tracker, {
          filter: { verified: false },
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(1)
        expect(parsedResult.deliverables[0].id).toBe('DL-002')
      })
    })

    describe('DL-T025: filter: verified without tracker', () => {
      it('ignores verified filter when tracker undefined', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'First', ['AC1']),
            Deliverable.pending('DL-002', 'Second', ['AC2']),
          ]),
        )

        const result = await handleListDeliverables(repository, undefined, {
          filter: { verified: false },
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        // All deliverables returned because verified filter is ignored
        expect(parsedResult.deliverables).toHaveLength(2)
      })
    })

    describe('DL-T026: limit', () => {
      it('applies limit to results', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'First', ['AC1']),
            Deliverable.pending('DL-002', 'Second', ['AC2']),
            Deliverable.pending('DL-003', 'Third', ['AC3']),
            Deliverable.pending('DL-004', 'Fourth', ['AC4']),
          ]),
        )

        const result = await handleListDeliverables(repository, undefined, {
          limit: 3,
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(3)
      })
    })

    describe('DL-T027: no filter', () => {
      it('returns all active deliverables', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Pending', ['AC1']),
            Deliverable.passed('DL-002', 'Passed', ['AC2']),
            Deliverable.blocked('DL-003', 'Blocked', ['AC3']),
          ]),
        )

        const result = await handleListDeliverables(repository, undefined, {})

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(3)
      })
    })

    describe('Combined filters', () => {
      it('combines status and verified filters', async () => {
        repository.setStatus(
          DeliverableStatus.create('2025-01-01', '2025-01-01', [
            Deliverable.pending('DL-001', 'Pending Verified', ['AC1']),
            Deliverable.pending('DL-002', 'Pending Unverified', ['AC2']),
            Deliverable.passed('DL-003', 'Passed Verified', ['AC3']),
          ]),
        )

        const tracker = VerificationTracker.fromIds([
          'DL-001',
          'DL-002',
          'DL-003',
        ])
        tracker.verify('DL-001')
        tracker.verify('DL-003')

        const result = await handleListDeliverables(repository, tracker, {
          filter: { status: 'pending', verified: false },
        })

        const parsedResult = JSON.parse(result.content[0]?.text ?? '')
        expect(parsedResult.deliverables).toHaveLength(1)
        expect(parsedResult.deliverables[0].id).toBe('DL-002')
      })
    })
  })

  describe('createDeliverableMcpServer', () => {
    describe('DL-T010: Server structure', () => {
      it('returns server and allowedTools', () => {
        const result = createDeliverableMcpServer(repository)

        expect(result).toHaveProperty('server')
        expect(result).toHaveProperty('allowedTools')
        // Server has McpSdkServerConfigWithInstance properties
        expect(result.server).toHaveProperty('type', 'sdk')
        expect(result.server).toHaveProperty('name')
        expect(result.server).toHaveProperty('instance')
      })
    })

    describe('DL-T011: Server configuration', () => {
      it('has correct server name', () => {
        const { server } = createDeliverableMcpServer(repository)

        expect(server.name).toBe('autonoe')
      })
    })

    describe('DL-T012: Server instance', () => {
      it('provides valid MCP server instance', () => {
        const { server } = createDeliverableMcpServer(repository)

        // SDK MCP server instance should be a valid object
        expect(server.instance).toBeDefined()
        expect(typeof server.instance).toBe('object')
      })
    })

    describe('Tool sets', () => {
      it('defaults to coding tool set', () => {
        const { server } = createDeliverableMcpServer(repository)
        // Server should be created without error using default coding toolset
        expect(server).toBeDefined()
        expect(server.name).toBe('autonoe')
      })

      it('accepts toolSet option', () => {
        const { server } = createDeliverableMcpServer(repository, {
          toolSet: 'initializer',
        })
        expect(server).toBeDefined()
      })

      it('accepts custom tool array', () => {
        const { server } = createDeliverableMcpServer(repository, {
          toolSet: ['create', 'deprecate'],
        })
        expect(server).toBeDefined()
      })

      it('accepts onStatusChange callback in options', () => {
        const callback = vi.fn()
        const { server } = createDeliverableMcpServer(repository, {
          toolSet: 'coding',
          onStatusChange: callback,
        })
        expect(server).toBeDefined()
      })
    })
  })

  describe('DELIVERABLE_TOOL_SETS', () => {
    it('initializer set contains only create', () => {
      expect(DELIVERABLE_TOOL_SETS.initializer).toEqual(['create'])
    })

    it('coding set contains set_status and list', () => {
      expect(DELIVERABLE_TOOL_SETS.coding).toEqual(['set_status', 'list'])
    })

    it('verify set contains set_status, verify, and list', () => {
      expect(DELIVERABLE_TOOL_SETS.verify).toEqual([
        'set_status',
        'verify',
        'list',
      ])
    })

    it('sync set contains create, deprecate, and list', () => {
      expect(DELIVERABLE_TOOL_SETS.sync).toEqual([
        'create',
        'deprecate',
        'list',
      ])
    })
  })

  describe('allowedTools', () => {
    it('returns MCP tool names for coding tool set', () => {
      const { allowedTools } = createDeliverableMcpServer(repository, {
        toolSet: 'coding',
      })

      expect(allowedTools).toEqual([
        'mcp__autonoe__set_status',
        'mcp__autonoe__list',
      ])
    })

    it('returns MCP tool names for initializer tool set', () => {
      const { allowedTools } = createDeliverableMcpServer(repository, {
        toolSet: 'initializer',
      })

      expect(allowedTools).toEqual(['mcp__autonoe__create'])
    })

    it('returns MCP tool names for sync tool set', () => {
      const { allowedTools } = createDeliverableMcpServer(repository, {
        toolSet: 'sync',
      })

      expect(allowedTools).toEqual([
        'mcp__autonoe__create',
        'mcp__autonoe__deprecate',
        'mcp__autonoe__list',
      ])
    })

    it('returns MCP tool names for verify tool set', () => {
      const { allowedTools } = createDeliverableMcpServer(repository, {
        toolSet: 'verify',
      })

      expect(allowedTools).toEqual([
        'mcp__autonoe__set_status',
        'mcp__autonoe__verify',
        'mcp__autonoe__list',
      ])
    })

    it('returns MCP tool names for custom tool array', () => {
      const { allowedTools } = createDeliverableMcpServer(repository, {
        toolSet: ['create', 'set_status'],
      })

      expect(allowedTools).toEqual([
        'mcp__autonoe__create',
        'mcp__autonoe__set_status',
      ])
    })
  })
})
