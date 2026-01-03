import { describe, it, expect } from 'vitest'
import {
  createDeliverables,
  setDeliverableStatus,
  allDeliverablesPassed,
  countPassedDeliverables,
  emptyDeliverableStatus,
  allAchievableDeliverablesPassed,
  hasBlockedDeliverables,
  countBlockedDeliverables,
  allDeliverablesBlocked,
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
            description: 'User Authentication',
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
        description: 'User Authentication',
        acceptanceCriteria: [
          'User can login with email and password',
          'Invalid credentials show error message',
        ],
        passed: false,
        blocked: false,
      })
    })

    it('creates multiple deliverables in batch', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            description: 'First',
            acceptanceCriteria: ['Criterion 1'],
          },
          {
            id: 'DL-002',
            description: 'Second',
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
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'First',
            acceptanceCriteria: ['Criterion 1'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-002',
            description: 'Second',
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
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Existing',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            description: 'Duplicate',
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
            description: 'First',
            acceptanceCriteria: ['Criterion 1'],
          },
          {
            id: 'DL-001',
            description: 'Duplicate',
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
            description: 'Description',
            acceptanceCriteria: ['Criterion'],
          },
        ],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
    })

    it('returns error for empty description', () => {
      const status = emptyDeliverableStatus()
      const input: CreateDeliverableInput = {
        deliverables: [
          {
            id: 'DL-001',
            description: '',
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
            description: 'Description',
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
            description: 'Description',
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
  describe('DL-T003: status=passed', () => {
    it('updates deliverable status to passed', () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        status: 'passed',
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(true)
      expect(result.result.message).toContain('passed')
      expect(result.status.deliverables[0]!.passed).toBe(true)
      expect(result.status.deliverables[0]!.blocked).toBe(false)
    })

    it('preserves other deliverables', () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'First',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
          {
            id: 'DL-002',
            description: 'Second',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        status: 'passed',
      }

      const result = setDeliverableStatus(status, input)

      expect(result.status.deliverables[0]!.passed).toBe(true)
      expect(result.status.deliverables[1]!.passed).toBe(false)
    })
  })

  describe('DL-T004: Invalid deliverable ID', () => {
    it('returns error for non-existent deliverable', () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Existing',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-999',
        status: 'passed',
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
        status: 'passed',
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('NOT_FOUND')
    })
  })

  describe('DL-T005: status=blocked', () => {
    it('sets deliverable to blocked state', () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        status: 'blocked',
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(true)
      expect(result.result.message).toContain('blocked')
      expect(result.status.deliverables[0]!.passed).toBe(false)
      expect(result.status.deliverables[0]!.blocked).toBe(true)
    })
  })

  describe('DL-T006: status=pending', () => {
    it('sets deliverable to pending state', () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: true,
            blocked: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        status: 'pending',
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(true)
      expect(result.result.message).toContain('pending')
      expect(result.status.deliverables[0]!.passed).toBe(false)
      expect(result.status.deliverables[0]!.blocked).toBe(false)
    })
  })

  describe('DL-T007: pending resets blocked state', () => {
    it('resets blocked deliverable to pending', () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: true,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: 'DL-001',
        status: 'pending',
      }

      const result = setDeliverableStatus(status, input)

      expect(result.result.success).toBe(true)
      expect(result.status.deliverables[0]!.passed).toBe(false)
      expect(result.status.deliverables[0]!.blocked).toBe(false)
    })
  })

  describe('Validation errors', () => {
    it('returns error for empty deliverable ID', () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: SetDeliverableStatusInput = {
        deliverableId: '',
        status: 'passed',
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
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
          blocked: false,
        },
        {
          id: 'DL-002',
          description: 'Second',
          acceptanceCriteria: ['Criterion'],
          passed: false,
          blocked: false,
        },
      ],
    }
    expect(allDeliverablesPassed(status)).toBe(false)
  })

  it('returns true when all deliverables passed', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
          blocked: false,
        },
        {
          id: 'DL-002',
          description: 'Second',
          acceptanceCriteria: ['Criterion'],
          passed: true,
          blocked: false,
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
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
          blocked: false,
        },
        {
          id: 'DL-002',
          description: 'Second',
          acceptanceCriteria: ['Criterion'],
          passed: false,
          blocked: false,
        },
        {
          id: 'DL-003',
          description: 'Third',
          acceptanceCriteria: ['Criterion'],
          passed: true,
          blocked: false,
        },
      ],
    }
    expect(countPassedDeliverables(status)).toBe(2)
  })
})

describe('emptyDeliverableStatus', () => {
  it('creates empty status with timestamps', () => {
    const status = emptyDeliverableStatus()
    expect(status.deliverables).toEqual([])
    expect(status.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(status.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('allAchievableDeliverablesPassed', () => {
  it('returns true when all non-blocked deliverables pass', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: true,
          blocked: false,
        },
        {
          id: 'DL-002',
          description: 'B',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
      ],
    }
    expect(allAchievableDeliverablesPassed(status)).toBe(true)
  })

  it('returns false when a non-blocked deliverable is not passed', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: true,
          blocked: false,
        },
        {
          id: 'DL-002',
          description: 'B',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: false,
        },
      ],
    }
    expect(allAchievableDeliverablesPassed(status)).toBe(false)
  })

  it('returns false when all deliverables are blocked', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
      ],
    }
    expect(allAchievableDeliverablesPassed(status)).toBe(false)
  })

  it('returns false for empty deliverables', () => {
    expect(allAchievableDeliverablesPassed(emptyDeliverableStatus())).toBe(
      false,
    )
  })
})

describe('hasBlockedDeliverables', () => {
  it('returns true when there are blocked deliverables', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
      ],
    }
    expect(hasBlockedDeliverables(status)).toBe(true)
  })

  it('returns false when there are no blocked deliverables', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: false,
        },
      ],
    }
    expect(hasBlockedDeliverables(status)).toBe(false)
  })
})

describe('countBlockedDeliverables', () => {
  it('counts blocked deliverables correctly', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: false,
        },
        {
          id: 'DL-002',
          description: 'B',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
        {
          id: 'DL-003',
          description: 'C',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
      ],
    }
    expect(countBlockedDeliverables(status)).toBe(2)
  })
})

describe('allDeliverablesBlocked', () => {
  it('returns true when all deliverables are blocked', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
        {
          id: 'DL-002',
          description: 'B',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
      ],
    }
    expect(allDeliverablesBlocked(status)).toBe(true)
  })

  it('returns false when some deliverables are not blocked', () => {
    const status: DeliverableStatus = {
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      deliverables: [
        {
          id: 'DL-001',
          description: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
        {
          id: 'DL-002',
          description: 'B',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: false,
        },
      ],
    }
    expect(allDeliverablesBlocked(status)).toBe(false)
  })

  it('returns false for empty deliverables', () => {
    expect(allDeliverablesBlocked(emptyDeliverableStatus())).toBe(false)
  })
})
