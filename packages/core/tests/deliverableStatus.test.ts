import { describe, it, expect } from 'vitest'
import { Deliverable } from '../src/deliverable'
import {
  DeliverableStatus,
  nullDeliverableStatusReader,
  type CreateDeliverableInput,
  type SetDeliverableStatusInput,
  type DeprecateDeliverableInput,
} from '../src/deliverableStatus'
import {
  createDeliverables,
  setDeliverableStatus,
  deprecateDeliverable,
} from '../src/deliverableService'

describe('createDeliverables', () => {
  describe('DL-T001: Valid input', () => {
    it('creates deliverable with acceptance criteria', () => {
      const status = DeliverableStatus.empty()
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
      expect(result.status.deliverables[0]!.id).toBe('DL-001')
      expect(result.status.deliverables[0]!.description).toBe(
        'User Authentication',
      )
      expect(result.status.deliverables[0]!.acceptanceCriteria).toEqual([
        'User can login with email and password',
        'Invalid credentials show error message',
      ])
      expect(result.status.deliverables[0]!.passed).toBe(false)
      expect(result.status.deliverables[0]!.blocked).toBe(false)
    })

    it('creates multiple deliverables in batch', () => {
      const status = DeliverableStatus.empty()
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'First', ['Criterion 1']),
      ])
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'Existing', ['Criterion']),
      ])
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
      const status = DeliverableStatus.empty()
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
      const status = DeliverableStatus.empty()
      const input: CreateDeliverableInput = {
        deliverables: [],
      }

      const result = createDeliverables(status, input)

      expect(result.result.success).toBe(false)
      expect(result.result.error).toBe('VALIDATION_ERROR')
      expect(result.result.message).toContain('At least one deliverable')
    })

    it('returns error for empty ID', () => {
      const status = DeliverableStatus.empty()
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
      const status = DeliverableStatus.empty()
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
      const status = DeliverableStatus.empty()
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
      const status = DeliverableStatus.empty()
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'Test', ['Criterion']),
      ])
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'First', ['Criterion']),
        Deliverable.pending('DL-002', 'Second', ['Criterion']),
      ])
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'Existing', ['Criterion']),
      ])
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
      const status = DeliverableStatus.empty()
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'Test', ['Criterion']),
      ])
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.passed('DL-001', 'Test', ['Criterion']),
      ])
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.blocked('DL-001', 'Test', ['Criterion']),
      ])
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
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'Test', ['Criterion']),
      ])
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

describe('DeliverableStatus.countPassed', () => {
  it('returns 0 for empty status', () => {
    const status = DeliverableStatus.empty()
    expect(status.countPassed()).toBe(0)
  })

  it('counts passed deliverables correctly', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.passed('DL-001', 'First', ['Criterion']),
      Deliverable.pending('DL-002', 'Second', ['Criterion']),
      Deliverable.passed('DL-003', 'Third', ['Criterion']),
    ])
    expect(status.countPassed()).toBe(2)
  })
})

describe('DeliverableStatus.empty', () => {
  it('creates empty status with timestamps', () => {
    const status = DeliverableStatus.empty()
    expect([...status.deliverables]).toEqual([])
    expect(status.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(status.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('DeliverableStatus.allAchievablePassed', () => {
  it('returns true when all non-blocked deliverables pass', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.passed('DL-001', 'A', ['C']),
      Deliverable.blocked('DL-002', 'B', ['C']),
    ])
    expect(status.allAchievablePassed()).toBe(true)
  })

  it('returns false when a non-blocked deliverable is not passed', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.passed('DL-001', 'A', ['C']),
      Deliverable.pending('DL-002', 'B', ['C']),
    ])
    expect(status.allAchievablePassed()).toBe(false)
  })

  it('returns false when all deliverables are blocked', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.blocked('DL-001', 'A', ['C']),
    ])
    expect(status.allAchievablePassed()).toBe(false)
  })

  it('returns false for empty deliverables', () => {
    expect(DeliverableStatus.empty().allAchievablePassed()).toBe(false)
  })
})

describe('DeliverableStatus.countBlocked', () => {
  it('counts blocked deliverables correctly', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.pending('DL-001', 'A', ['C']),
      Deliverable.blocked('DL-002', 'B', ['C']),
      Deliverable.blocked('DL-003', 'C', ['C']),
    ])
    expect(status.countBlocked()).toBe(2)
  })
})

describe('DeliverableStatus.allBlocked', () => {
  it('returns true when all deliverables are blocked', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.blocked('DL-001', 'A', ['C']),
      Deliverable.blocked('DL-002', 'B', ['C']),
    ])
    expect(status.allBlocked()).toBe(true)
  })

  it('returns false when some deliverables are not blocked', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.blocked('DL-001', 'A', ['C']),
      Deliverable.pending('DL-002', 'B', ['C']),
    ])
    expect(status.allBlocked()).toBe(false)
  })

  it('returns false for empty deliverables', () => {
    expect(DeliverableStatus.empty().allBlocked()).toBe(false)
  })
})

describe('nullDeliverableStatusReader', () => {
  it('exists() always returns false', async () => {
    expect(await nullDeliverableStatusReader.exists()).toBe(false)
  })

  it('load() returns empty status with timestamps', async () => {
    const status = await nullDeliverableStatusReader.load()
    expect([...status.deliverables]).toEqual([])
    expect(status.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(status.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('DeliverableStatus deprecated handling', () => {
  describe('activeDeliverables', () => {
    it('excludes deprecated deliverables', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'Active', ['C']),
        Deliverable.create(
          'DL-002',
          'Deprecated',
          ['C'],
          false,
          false,
          '2025-01-10',
        ),
        Deliverable.pending('DL-003', 'Also Active', ['C']),
      ])

      expect(status.activeDeliverables).toHaveLength(2)
      expect(status.activeDeliverables.map((d) => d.id)).toEqual([
        'DL-001',
        'DL-003',
      ])
    })

    it('returns all deliverables when none are deprecated', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'A', ['C']),
        Deliverable.pending('DL-002', 'B', ['C']),
      ])

      expect(status.activeDeliverables).toHaveLength(2)
    })

    it('returns empty array when all are deprecated', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.create('DL-001', 'A', ['C'], true, false, '2025-01-10'),
        Deliverable.create('DL-002', 'B', ['C'], false, false, '2025-01-10'),
      ])

      expect(status.activeDeliverables).toHaveLength(0)
    })
  })

  describe('countDeprecated', () => {
    it('returns 0 when no deprecated deliverables', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'A', ['C']),
        Deliverable.passed('DL-002', 'B', ['C']),
      ])

      expect(status.countDeprecated()).toBe(0)
    })

    it('counts deprecated deliverables correctly', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.pending('DL-001', 'A', ['C']),
        Deliverable.create('DL-002', 'B', ['C'], true, false, '2025-01-10'),
        Deliverable.create('DL-003', 'C', ['C'], false, false, '2025-01-10'),
      ])

      expect(status.countDeprecated()).toBe(2)
    })
  })

  describe('countPassed excludes deprecated', () => {
    it('does not count deprecated deliverables even if passed', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.passed('DL-001', 'Active Passed', ['C']),
        Deliverable.create(
          'DL-002',
          'Deprecated Passed',
          ['C'],
          true,
          false,
          '2025-01-10',
        ),
        Deliverable.pending('DL-003', 'Active Pending', ['C']),
      ])

      expect(status.countPassed()).toBe(1)
    })
  })

  describe('countBlocked excludes deprecated', () => {
    it('does not count deprecated deliverables even if blocked', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.blocked('DL-001', 'Active Blocked', ['C']),
        Deliverable.create(
          'DL-002',
          'Deprecated Blocked',
          ['C'],
          false,
          true,
          '2025-01-10',
        ),
        Deliverable.pending('DL-003', 'Active Pending', ['C']),
      ])

      expect(status.countBlocked()).toBe(1)
    })
  })

  describe('allAchievablePassed excludes deprecated', () => {
    it('returns true when all active non-blocked pass, ignoring deprecated', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.passed('DL-001', 'Active Passed', ['C']),
        Deliverable.create(
          'DL-002',
          'Deprecated Pending',
          ['C'],
          false,
          false,
          '2025-01-10',
        ),
      ])

      expect(status.allAchievablePassed()).toBe(true)
    })

    it('returns false when only deprecated deliverables exist', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.create(
          'DL-001',
          'Deprecated',
          ['C'],
          true,
          false,
          '2025-01-10',
        ),
      ])

      expect(status.allAchievablePassed()).toBe(false)
    })
  })

  describe('allBlocked excludes deprecated', () => {
    it('returns true when all active are blocked, ignoring deprecated', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.blocked('DL-001', 'Active Blocked', ['C']),
        Deliverable.create(
          'DL-002',
          'Deprecated Pending',
          ['C'],
          false,
          false,
          '2025-01-10',
        ),
      ])

      expect(status.allBlocked()).toBe(true)
    })

    it('returns false when only deprecated deliverables exist', () => {
      const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
        Deliverable.create(
          'DL-001',
          'Deprecated',
          ['C'],
          false,
          true,
          '2025-01-10',
        ),
      ])

      expect(status.allBlocked()).toBe(false)
    })
  })
})

describe('deprecateDeliverable', () => {
  it('marks deliverable as deprecated', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.pending('DL-001', 'Test', ['Criterion']),
    ])
    const input: DeprecateDeliverableInput = {
      deliverableId: 'DL-001',
    }

    const result = deprecateDeliverable(status, input)

    expect(result.result.success).toBe(true)
    expect(result.result.message).toContain('deprecated')
    expect(result.status.deliverables[0]!.deprecated).toBe(true)
    expect(result.status.deliverables[0]!.deprecatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })

  it('preserves existing status when deprecating', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.passed('DL-001', 'Test', ['Criterion']),
    ])
    const input: DeprecateDeliverableInput = {
      deliverableId: 'DL-001',
    }

    const result = deprecateDeliverable(status, input)

    expect(result.status.deliverables[0]!.passed).toBe(true)
    expect(result.status.deliverables[0]!.deprecated).toBe(true)
  })

  it('returns error for non-existent deliverable', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.pending('DL-001', 'Existing', ['Criterion']),
    ])
    const input: DeprecateDeliverableInput = {
      deliverableId: 'DL-999',
    }

    const result = deprecateDeliverable(status, input)

    expect(result.result.success).toBe(false)
    expect(result.result.error).toBe('NOT_FOUND')
    expect(result.result.message).toContain('not found')
    expect(result.status).toBe(status) // Status unchanged
  })

  it('returns error for already deprecated deliverable', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.create(
        'DL-001',
        'Already Deprecated',
        ['Criterion'],
        false,
        false,
        '2025-01-10',
      ),
    ])
    const input: DeprecateDeliverableInput = {
      deliverableId: 'DL-001',
    }

    const result = deprecateDeliverable(status, input)

    expect(result.result.success).toBe(false)
    expect(result.result.error).toBe('VALIDATION_ERROR')
    expect(result.result.message).toContain('already deprecated')
    expect(result.status).toBe(status) // Status unchanged
  })

  it('returns error for empty deliverable ID', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.pending('DL-001', 'Test', ['Criterion']),
    ])
    const input: DeprecateDeliverableInput = {
      deliverableId: '',
    }

    const result = deprecateDeliverable(status, input)

    expect(result.result.success).toBe(false)
    expect(result.result.error).toBe('VALIDATION_ERROR')
  })

  it('preserves other deliverables', () => {
    const status = DeliverableStatus.create('2025-01-01', '2025-01-01', [
      Deliverable.pending('DL-001', 'First', ['Criterion']),
      Deliverable.pending('DL-002', 'Second', ['Criterion']),
    ])
    const input: DeprecateDeliverableInput = {
      deliverableId: 'DL-001',
    }

    const result = deprecateDeliverable(status, input)

    expect(result.status.deliverables[0]!.deprecated).toBe(true)
    expect(result.status.deliverables[1]!.deprecated).toBe(false)
  })
})
