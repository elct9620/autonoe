import { describe, it, expect } from 'vitest'
import {
  createDeliverables,
  setDeliverableStatus,
  blockDeliverable,
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
  type BlockDeliverableInput,
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
        blocked: false,
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
            blocked: false,
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
            blocked: false,
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
            blocked: false,
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
            blocked: false,
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
            blocked: false,
          },
          {
            id: 'DL-002',
            name: 'Second',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
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
            blocked: false,
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
            blocked: false,
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
            blocked: false,
        },
        {
          id: 'DL-002',
          name: 'Second',
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
      deliverables: [
        {
          id: 'DL-001',
          name: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
            blocked: false,
        },
        {
          id: 'DL-002',
          name: 'Second',
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
      deliverables: [
        {
          id: 'DL-001',
          name: 'First',
          acceptanceCriteria: ['Criterion'],
          passed: true,
            blocked: false,
        },
        {
          id: 'DL-002',
          name: 'Second',
          acceptanceCriteria: ['Criterion'],
          passed: false,
            blocked: false,
        },
        {
          id: 'DL-003',
          name: 'Third',
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
  it('creates empty status', () => {
    const status = emptyDeliverableStatus()
    expect(status).toEqual({ deliverables: [] })
  })
})

describe('blockDeliverable', () => {
  describe('DL-T010: Valid block (passed=false)', () => {
    it('blocks deliverable when passed is false', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const input: BlockDeliverableInput = { deliverableId: 'DL-001' }

      const result = blockDeliverable(status, input)

      expect(result.result.success).toBe(true)
      expect(result.status.deliverables[0]?.blocked).toBe(true)
    })
  })

  describe('DL-T011: Invalid ID', () => {
    it('returns NOT_FOUND error for non-existent deliverable', () => {
      const status = emptyDeliverableStatus()
      const input: BlockDeliverableInput = { deliverableId: 'DL-999' }

      const result = blockDeliverable(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('NOT_FOUND')
    })
  })

  describe('DL-T012: Mutual exclusion (passed=true)', () => {
    it('returns MUTUAL_EXCLUSION error when trying to block a passed deliverable', () => {
      const status: DeliverableStatus = {
        deliverables: [
          {
            id: 'DL-001',
            name: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: true,
            blocked: false,
          },
        ],
      }
      const input: BlockDeliverableInput = { deliverableId: 'DL-001' }

      const result = blockDeliverable(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('MUTUAL_EXCLUSION')
    })
  })

  describe('Validation errors', () => {
    it('returns error for empty deliverableId', () => {
      const status = emptyDeliverableStatus()
      const input: BlockDeliverableInput = { deliverableId: '' }

      const result = blockDeliverable(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
    })
  })
})

describe('allAchievableDeliverablesPassed', () => {
  it('returns true when all non-blocked deliverables pass', () => {
    const status: DeliverableStatus = {
      deliverables: [
        { id: 'DL-001', name: 'A', acceptanceCriteria: ['C'], passed: true, blocked: false },
        {
          id: 'DL-002',
          name: 'B',
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
      deliverables: [
        { id: 'DL-001', name: 'A', acceptanceCriteria: ['C'], passed: true, blocked: false },
        { id: 'DL-002', name: 'B', acceptanceCriteria: ['C'], passed: false, blocked: false },
      ],
    }
    expect(allAchievableDeliverablesPassed(status)).toBe(false)
  })

  it('returns false when all deliverables are blocked', () => {
    const status: DeliverableStatus = {
      deliverables: [
        {
          id: 'DL-001',
          name: 'A',
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
      deliverables: [
        {
          id: 'DL-001',
          name: 'A',
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
      deliverables: [
        { id: 'DL-001', name: 'A', acceptanceCriteria: ['C'], passed: false, blocked: false },
      ],
    }
    expect(hasBlockedDeliverables(status)).toBe(false)
  })
})

describe('countBlockedDeliverables', () => {
  it('counts blocked deliverables correctly', () => {
    const status: DeliverableStatus = {
      deliverables: [
        { id: 'DL-001', name: 'A', acceptanceCriteria: ['C'], passed: false, blocked: false },
        {
          id: 'DL-002',
          name: 'B',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
        {
          id: 'DL-003',
          name: 'C',
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
      deliverables: [
        {
          id: 'DL-001',
          name: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
        {
          id: 'DL-002',
          name: 'B',
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
      deliverables: [
        {
          id: 'DL-001',
          name: 'A',
          acceptanceCriteria: ['C'],
          passed: false,
          blocked: true,
        },
        { id: 'DL-002', name: 'B', acceptanceCriteria: ['C'], passed: false, blocked: false },
      ],
    }
    expect(allDeliverablesBlocked(status)).toBe(false)
  })

  it('returns false for empty deliverables', () => {
    expect(allDeliverablesBlocked(emptyDeliverableStatus())).toBe(false)
  })
})
