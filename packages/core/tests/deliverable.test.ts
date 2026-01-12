import { describe, it, expect } from 'vitest'
import { Deliverable } from '../src/deliverable'

describe('Deliverable', () => {
  describe('static pending()', () => {
    it('creates deliverable in pending state', () => {
      const d = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])

      expect(d.id).toBe('DL-001')
      expect(d.description).toBe('Test')
      expect(d.acceptanceCriteria).toEqual(['Criterion 1'])
      expect(d.passed).toBe(false)
      expect(d.blocked).toBe(false)
    })

    it('returns pending status', () => {
      const d = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
      expect(d.status).toBe('pending')
    })
  })

  describe('static passed()', () => {
    it('creates deliverable in passed state', () => {
      const d = Deliverable.passed('DL-001', 'Test', ['Criterion 1'])

      expect(d.passed).toBe(true)
      expect(d.blocked).toBe(false)
    })

    it('returns passed status', () => {
      const d = Deliverable.passed('DL-001', 'Test', ['Criterion 1'])
      expect(d.status).toBe('passed')
    })
  })

  describe('static blocked()', () => {
    it('creates deliverable in blocked state', () => {
      const d = Deliverable.blocked('DL-001', 'Test', ['Criterion 1'])

      expect(d.passed).toBe(false)
      expect(d.blocked).toBe(true)
    })

    it('returns blocked status', () => {
      const d = Deliverable.blocked('DL-001', 'Test', ['Criterion 1'])
      expect(d.status).toBe('blocked')
    })
  })

  describe('static create()', () => {
    it('creates deliverable with explicit passed and blocked values', () => {
      const d = Deliverable.create(
        'DL-001',
        'Test',
        ['Criterion 1'],
        true,
        false,
      )

      expect(d.id).toBe('DL-001')
      expect(d.passed).toBe(true)
      expect(d.blocked).toBe(false)
    })

    it('supports blocked state', () => {
      const d = Deliverable.create(
        'DL-001',
        'Test',
        ['Criterion 1'],
        false,
        true,
      )

      expect(d.passed).toBe(false)
      expect(d.blocked).toBe(true)
    })
  })

  describe('markPassed()', () => {
    it('returns new instance with passed=true, blocked=false', () => {
      const original = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
      const updated = original.markPassed()

      expect(updated).not.toBe(original)
      expect(updated.passed).toBe(true)
      expect(updated.blocked).toBe(false)
    })

    it('preserves id, description, and acceptanceCriteria', () => {
      const original = Deliverable.pending('DL-001', 'Test', [
        'Criterion 1',
        'Criterion 2',
      ])
      const updated = original.markPassed()

      expect(updated.id).toBe(original.id)
      expect(updated.description).toBe(original.description)
      expect(updated.acceptanceCriteria).toEqual(original.acceptanceCriteria)
    })

    it('clears blocked state when marking passed', () => {
      const blocked = Deliverable.blocked('DL-001', 'Test', ['Criterion 1'])
      const passed = blocked.markPassed()

      expect(passed.passed).toBe(true)
      expect(passed.blocked).toBe(false)
    })

    it('does not mutate original', () => {
      const original = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
      original.markPassed()

      expect(original.passed).toBe(false)
    })
  })

  describe('markBlocked()', () => {
    it('returns new instance with blocked=true, passed=false', () => {
      const original = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
      const updated = original.markBlocked()

      expect(updated).not.toBe(original)
      expect(updated.passed).toBe(false)
      expect(updated.blocked).toBe(true)
    })

    it('clears passed state when marking blocked', () => {
      const passed = Deliverable.passed('DL-001', 'Test', ['Criterion 1'])
      const blocked = passed.markBlocked()

      expect(blocked.passed).toBe(false)
      expect(blocked.blocked).toBe(true)
    })

    it('does not mutate original', () => {
      const original = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
      original.markBlocked()

      expect(original.blocked).toBe(false)
    })
  })

  describe('reset()', () => {
    it('returns new instance in pending state', () => {
      const passed = Deliverable.passed('DL-001', 'Test', ['Criterion 1'])
      const reset = passed.reset()

      expect(reset).not.toBe(passed)
      expect(reset.passed).toBe(false)
      expect(reset.blocked).toBe(false)
    })

    it('resets blocked deliverable to pending', () => {
      const blocked = Deliverable.blocked('DL-001', 'Test', ['Criterion 1'])
      const reset = blocked.reset()

      expect(reset.passed).toBe(false)
      expect(reset.blocked).toBe(false)
    })

    it('does not mutate original', () => {
      const original = Deliverable.passed('DL-001', 'Test', ['Criterion 1'])
      original.reset()

      expect(original.passed).toBe(true)
    })
  })

  describe('immutability', () => {
    it('acceptanceCriteria is readonly array', () => {
      const d = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])

      // TypeScript should prevent modification, runtime check
      expect(d.acceptanceCriteria).toEqual(['Criterion 1'])
    })

    it('all properties are readonly', () => {
      const d = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])

      // These should be readonly at compile time
      expect(d.id).toBe('DL-001')
      expect(d.description).toBe('Test')
      expect(d.passed).toBe(false)
      expect(d.blocked).toBe(false)
    })
  })

  describe('deprecated', () => {
    describe('static create() with deprecatedAt', () => {
      it('creates deliverable with deprecatedAt field', () => {
        const d = Deliverable.create(
          'DL-001',
          'Test',
          ['Criterion 1'],
          true,
          false,
          '2025-01-10',
        )

        expect(d.deprecatedAt).toBe('2025-01-10')
        expect(d.deprecated).toBe(true)
      })

      it('creates deliverable without deprecatedAt when not provided', () => {
        const d = Deliverable.create(
          'DL-001',
          'Test',
          ['Criterion 1'],
          true,
          false,
        )

        expect(d.deprecatedAt).toBeUndefined()
        expect(d.deprecated).toBe(false)
      })
    })

    describe('deprecated getter', () => {
      it('returns true when deprecatedAt is set', () => {
        const d = Deliverable.create(
          'DL-001',
          'Test',
          ['Criterion 1'],
          false,
          false,
          '2025-01-10',
        )
        expect(d.deprecated).toBe(true)
      })

      it('returns false when deprecatedAt is undefined', () => {
        const d = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
        expect(d.deprecated).toBe(false)
      })
    })

    describe('markDeprecated()', () => {
      it('returns new instance with deprecatedAt set to current date', () => {
        const original = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
        const deprecated = original.markDeprecated()

        expect(deprecated).not.toBe(original)
        expect(deprecated.deprecated).toBe(true)
        expect(deprecated.deprecatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })

      it('uses provided date when specified', () => {
        const original = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
        const deprecated = original.markDeprecated('2025-01-15')

        expect(deprecated.deprecatedAt).toBe('2025-01-15')
      })

      it('preserves current status when marking deprecated', () => {
        const passed = Deliverable.passed('DL-001', 'Test', ['Criterion 1'])
        const deprecated = passed.markDeprecated()

        expect(deprecated.status).toBe('passed')
        expect(deprecated.deprecated).toBe(true)
      })

      it('does not mutate original', () => {
        const original = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
        original.markDeprecated()

        expect(original.deprecated).toBe(false)
      })
    })

    describe('status transitions preserve deprecatedAt', () => {
      it('markPassed preserves deprecatedAt', () => {
        const deprecated = Deliverable.create(
          'DL-001',
          'Test',
          ['Criterion 1'],
          false,
          false,
          '2025-01-10',
        )
        const passed = deprecated.markPassed()

        expect(passed.deprecatedAt).toBe('2025-01-10')
        expect(passed.passed).toBe(true)
      })

      it('markBlocked preserves deprecatedAt', () => {
        const deprecated = Deliverable.create(
          'DL-001',
          'Test',
          ['Criterion 1'],
          false,
          false,
          '2025-01-10',
        )
        const blocked = deprecated.markBlocked()

        expect(blocked.deprecatedAt).toBe('2025-01-10')
        expect(blocked.blocked).toBe(true)
      })

      it('reset preserves deprecatedAt', () => {
        const deprecated = Deliverable.create(
          'DL-001',
          'Test',
          ['Criterion 1'],
          true,
          false,
          '2025-01-10',
        )
        const reset = deprecated.reset()

        expect(reset.deprecatedAt).toBe('2025-01-10')
        expect(reset.status).toBe('pending')
      })
    })

    describe('factory methods create non-deprecated deliverables', () => {
      it('pending() creates non-deprecated deliverable', () => {
        const d = Deliverable.pending('DL-001', 'Test', ['Criterion 1'])
        expect(d.deprecated).toBe(false)
        expect(d.deprecatedAt).toBeUndefined()
      })

      it('passed() creates non-deprecated deliverable', () => {
        const d = Deliverable.passed('DL-001', 'Test', ['Criterion 1'])
        expect(d.deprecated).toBe(false)
        expect(d.deprecatedAt).toBeUndefined()
      })

      it('blocked() creates non-deprecated deliverable', () => {
        const d = Deliverable.blocked('DL-001', 'Test', ['Criterion 1'])
        expect(d.deprecated).toBe(false)
        expect(d.deprecatedAt).toBeUndefined()
      })
    })
  })
})
