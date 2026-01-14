import { describe, it, expect } from 'vitest'
import { VerificationTracker } from '../src/verificationTracker'
import { DeliverableStatus } from '../src/deliverableStatus'
import { Deliverable } from '../src/deliverable'

describe('VerificationTracker', () => {
  describe('fromIds', () => {
    it('creates tracker with given IDs', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002', 'D-003'])

      expect(tracker.totalCount).toBe(3)
      expect(tracker.verifiedCount).toBe(0)
    })

    it('creates tracker with empty array', () => {
      const tracker = VerificationTracker.fromIds([])

      expect(tracker.totalCount).toBe(0)
      expect(tracker.verifiedCount).toBe(0)
    })
  })

  describe('fromStatus', () => {
    it('creates tracker with active deliverable IDs only', () => {
      const activeDeliverable = Deliverable.pending('D-001', 'Active', ['AC1'])
      const deprecatedDeliverable = Deliverable.create(
        'D-002',
        'Deprecated',
        ['AC1'],
        false,
        false,
        '2025-01-14',
      )

      const status = DeliverableStatus.create('2025-01-14', '2025-01-14', [
        activeDeliverable,
        deprecatedDeliverable,
      ])
      const tracker = VerificationTracker.fromStatus(status)

      expect(tracker.totalCount).toBe(1)
      expect(tracker.unverifiedIds()).toEqual(['D-001'])
    })
  })

  describe('empty', () => {
    it('creates empty tracker', () => {
      const tracker = VerificationTracker.empty()

      expect(tracker.totalCount).toBe(0)
      expect(tracker.verifiedCount).toBe(0)
      expect(tracker.allVerified()).toBe(true)
    })
  })

  describe('verify', () => {
    it('marks existing ID as verified', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002'])

      const result = tracker.verify('D-001')

      expect(result).toBe(true)
      expect(tracker.isVerified('D-001')).toBe(true)
      expect(tracker.verifiedCount).toBe(1)
    })

    it('returns false for unknown ID', () => {
      const tracker = VerificationTracker.fromIds(['D-001'])

      const result = tracker.verify('D-999')

      expect(result).toBe(false)
      expect(tracker.verifiedCount).toBe(0)
    })

    it('is idempotent for same ID', () => {
      const tracker = VerificationTracker.fromIds(['D-001'])

      tracker.verify('D-001')
      tracker.verify('D-001')

      expect(tracker.verifiedCount).toBe(1)
    })
  })

  describe('isVerified', () => {
    it('returns true for verified ID', () => {
      const tracker = VerificationTracker.fromIds(['D-001'])
      tracker.verify('D-001')

      expect(tracker.isVerified('D-001')).toBe(true)
    })

    it('returns false for unverified ID', () => {
      const tracker = VerificationTracker.fromIds(['D-001'])

      expect(tracker.isVerified('D-001')).toBe(false)
    })

    it('returns false for unknown ID', () => {
      const tracker = VerificationTracker.fromIds(['D-001'])

      expect(tracker.isVerified('D-999')).toBe(false)
    })
  })

  describe('allVerified', () => {
    it('returns true when all deliverables are verified', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002'])
      tracker.verify('D-001')
      tracker.verify('D-002')

      expect(tracker.allVerified()).toBe(true)
    })

    it('returns false when some deliverables are not verified', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002'])
      tracker.verify('D-001')

      expect(tracker.allVerified()).toBe(false)
    })

    it('returns true for empty tracker', () => {
      const tracker = VerificationTracker.fromIds([])

      expect(tracker.allVerified()).toBe(true)
    })
  })

  describe('unverifiedIds', () => {
    it('returns all IDs when none verified', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002', 'D-003'])

      expect(tracker.unverifiedIds()).toEqual(['D-001', 'D-002', 'D-003'])
    })

    it('returns only unverified IDs', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002', 'D-003'])
      tracker.verify('D-002')

      expect(tracker.unverifiedIds()).toEqual(['D-001', 'D-003'])
    })

    it('returns empty array when all verified', () => {
      const tracker = VerificationTracker.fromIds(['D-001'])
      tracker.verify('D-001')

      expect(tracker.unverifiedIds()).toEqual([])
    })
  })

  describe('verifiedCount', () => {
    it('returns count of verified deliverables', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002', 'D-003'])
      tracker.verify('D-001')
      tracker.verify('D-003')

      expect(tracker.verifiedCount).toBe(2)
    })
  })

  describe('totalCount', () => {
    it('returns total number of tracked deliverables', () => {
      const tracker = VerificationTracker.fromIds(['D-001', 'D-002', 'D-003'])

      expect(tracker.totalCount).toBe(3)
    })
  })
})
