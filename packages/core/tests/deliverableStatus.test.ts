import { describe, it, expect } from 'vitest'
import {
  createDeliverables,
  setDeliverableStatus,
  allDeliverablesPassed,
  countPassedDeliverables,
  emptyDeliverableStatus,
  type DeliverableStatus,
  type CreateDeliverableInput,
  type SetDeliverableStatusInput,
} from '../src/deliverableStatus'

describe('createDeliverables', () => {
  describe('DL-T001: Valid input', () => {
    it('creates deliverable with acceptance criteria', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'User Authentication',
            acceptanceCriteria: [
              'User can login with email and password',
              'Invalid credentials show error message',
            ],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(true)
      expect(result.result.message).toContain('1 deliverable')
      expect(result.status.deliverables).toHaveLength(1)
      expect(result.status.deliverables[0]).toEqual({
        id: 'DL-001',
        name: 'User Authentication',
        acceptanceCriteria: [
          'User can login with email and password',
          'Invalid credentials show error message',
        ],
        passed: false,
      })
    })

    it('creates multiple deliverables in batch', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'First',
            acceptanceCriteria: ['Criterion 1'],
          },
          {
            id: 'DL-002',
            name: 'Second',
            acceptanceCriteria: ['Criterion 2'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(true)
      expect(result.result.message).toContain('2 deliverable')
      expect(result.status.deliverables).toHaveLength(2)
      expect(result.status.deliverables[0]!.id).toBe('DL-001')
      expect(result.status.deliverables[1]!.id).toBe('DL-002')
    })

    it('appends to existing deliverables', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'First',
            acceptanceCriteria: ['Criterion 1'],
            passed: false,
          },
        ],
      }
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-002',
            name: 'Second',
            acceptanceCriteria: ['Criterion 2'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.status.deliverables).toHaveLength(2)
      expect(result.status.deliverables[1]!.id).toBe('DL-002')
    })
  })

  describe('DL-T002: Duplicate ID', () => {
    it('returns error for duplicate deliverable ID in existing status', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Existing',
            acceptanceCriteria: ['Criterion'],
            passed: false,
          },
        ],
      }
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Duplicate',
            acceptanceCriteria: ['Another criterion'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('DUPLICATE_ID')
      expect(result.result.message).toContain('already exists')
      expect(result.status).toBe(status) // Status unchanged
    })

    it('returns error for duplicate ID within batch', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'First',
            acceptanceCriteria: ['Criterion 1'],
          },
          {
            id: 'DL-001',
            name: 'Duplicate',
            acceptanceCriteria: ['Criterion 2'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('DUPLICATE_ID')
      expect(result.result.message).toContain('Duplicate ID')
    })
  })

  describe('Validation errors', () => {
    it('returns error for empty deliverables array', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
      expect(result.result.message).toContain('At least one deliverable')
    })

    it('returns error for empty ID', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: '',
            name: 'Name',
            acceptanceCriteria: ['Criterion'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
    })

    it('returns error for empty name', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            name: '',
            acceptanceCriteria: ['Criterion'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
    })

    it('returns error for empty acceptance criteria array', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Name',
            acceptanceCriteria: [],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
    })

    it('returns error for empty acceptance criterion string', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Name',
            acceptanceCriteria: ['Valid', '', 'Also valid'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
    })
  })
})

describe('setDeliverableStatus', () => {
  describe('DL-T003: Valid update', () => {
    it('updates deliverable status to passed', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        passed: true,
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(true)
      expect(result.result.message).toContain('passed')
      expect(result.status.deliverables[0]!.passed).toBe(true)
    })

    it('updates deliverable status to failed', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: true,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        passed: false,
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(true)
      expect(result.result.message).toContain('failed')
      expect(result.status.deliverables[0]!.passed).toBe(false)
    })

    it('preserves other deliverables', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'First',
            acceptanceCriteria: ['Criterion'],
            passed: false,
          },
          {
            id: 'DL-002',
            name: 'Second',
            acceptanceCriteria: ['Criterion'],
            passed: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        passed: true,
      }

      const result = setDeliverableStatus(status, input)

      expect(result.status.deliverables[0]!.passed).toBe(true)
      expect(result.status.deliverables[1]!.passed).toBe(false)
    })
  })

  describe('DL-T004: Invalid deliverable ID', () => {
    it('returns error for non-existent deliverable', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Existing',
            acceptanceCriteria: ['Criterion'],
            passed: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-999',
        passed: true,
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('NOT_FOUND')
      expect(result.result.message).toContain('not found')
      expect(result.status).toBe(status) // Status unchanged
    })

    it('handles empty status', () => {
      const status = emptyDeliverableStatus()
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        passed: true,
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('NOT_FOUND')
    })
  })

  describe('Validation errors', () => {
    it('returns error for empty deliverable ID', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: '',
        passed: true,
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
    })
  })
})

describe('allDeliverablesPassed', () => {
  it('returns false for empty status', () => {
    const status = emptyDeliverableStatus()
    expect(allDeliverablesPassed(status)).toBe(false)
  })

  it('returns false when some deliverables not passed', () => {
    const status: DeliverableStatus = {
      deliverables: [
        {
          id: 'DL-001',
          name: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
        },
        {
          id: 'DL-002',
          name: 'Second',
          acceptanceCriteria: ['Criterion'],
          passed: false,
        },
      ],
    }
    expect(allDeliverablesPassed(status)).toBe(false)
  })

  it('returns true when all deliverables passed', () => {
    const status: DeliverableStatus = {
      deliverables: [
        {
          id: 'DL-001',
          name: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
        },
        {
          id: 'DL-002',
          name: 'Second',
          acceptanceCriteria: ['Criterion'],
          passed: true,
        },
      ],
    }
    expect(allDeliverablesPassed(status)).toBe(true)
  })
})

describe('countPassedDeliverables', () => {
  it('returns 0 for empty status', () => {
    const status = emptyDeliverableStatus()
    expect(countPassedDeliverables(status)).toBe(0)
  })

  it('counts passed deliverables correctly', () => {
    const status: DeliverableStatus = {
      deliverables: [
        {
          id: 'DL-001',
          name: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
        },
        {
          id: 'DL-002',
          name: 'Second',
          acceptanceCriteria: ['Criterion'],
          passed: false,
        },
        {
          id: 'DL-003',
          name: 'Third',
          acceptanceCriteria: ['Criterion'],
          passed: true,
        },
      ],
    }
    expect(countPassedDeliverables(status)).toBe(2)
  })
})

describe('emptyDeliverableStatus', () => {
  it('creates empty status', () => {
    const status = emptyDeliverableStatus()
    expect(status).toEqual({ deliverables: [] })
  })
})
