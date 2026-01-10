import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isQuotaExceededMessage,
  parseQuotaResetTime,
  calculateWaitDuration,
} from '../src/quotaManager'

/**
 * QuotaManager Tests
 * @see SPEC.md Section 3.10
 */

describe('isQuotaExceededMessage', () => {
  it('QM-001: detects exact match', () => {
    expect(isQuotaExceededMessage("You've hit your limit")).toBe(true)
  })

  it('QM-002: case insensitive match', () => {
    expect(isQuotaExceededMessage("YOU'VE HIT YOUR LIMIT")).toBe(true)
  })

  it('QM-003: detects when embedded in message', () => {
    expect(
      isQuotaExceededMessage("Error: You've hit your limit for today"),
    ).toBe(true)
  })

  it('QM-004: returns false for no match', () => {
    expect(isQuotaExceededMessage('Everything is fine')).toBe(false)
  })

  it('QM-005: returns false for empty string', () => {
    expect(isQuotaExceededMessage('')).toBe(false)
  })
})

describe('parseQuotaResetTime', () => {
  describe('pattern matching', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // Set current time to 2024-01-15 10:00:00 UTC
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 10, 0, 0)))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('QM-010: parses basic AM format', () => {
      const result = parseQuotaResetTime('resets 5am (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(5)
    })

    it('QM-011: parses basic PM format', () => {
      const result = parseQuotaResetTime('resets 3pm (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(15)
    })

    it('QM-012: parses singular reset (s is optional)', () => {
      const result = parseQuotaResetTime('reset 5am (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(5)
    })

    it('QM-013: parses with extra whitespace', () => {
      const result = parseQuotaResetTime('resets  5pm  (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(17)
    })

    it('QM-014: parses two-digit hour', () => {
      const result = parseQuotaResetTime('resets 10am (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(10)
    })

    it('QM-015: returns undefined for no match', () => {
      expect(parseQuotaResetTime('no reset time here')).toBeUndefined()
    })
  })

  describe('AM/PM edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // Set current time to 2024-01-15 00:30:00 UTC (early morning)
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 0, 30, 0)))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('QM-020: 12am converts to 0 (midnight)', () => {
      const result = parseQuotaResetTime('resets 12am (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(0)
    })

    it('QM-021: 12pm stays as 12 (noon)', () => {
      const result = parseQuotaResetTime('resets 12pm (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(12)
    })

    it('QM-022: 1pm converts to 13', () => {
      const result = parseQuotaResetTime('resets 1pm (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(13)
    })

    it('QM-023: 11pm converts to 23', () => {
      const result = parseQuotaResetTime('resets 11pm (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCHours()).toBe(23)
    })
  })

  describe('next day logic', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('QM-030: future time same day returns same day', () => {
      vi.useFakeTimers()
      // Current time: 2024-01-15 10:00:00 UTC
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 10, 0, 0)))

      const result = parseQuotaResetTime('resets 3pm (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCDate()).toBe(15)
      expect(result!.getUTCHours()).toBe(15)
    })

    it('QM-031: past time wraps to next day', () => {
      vi.useFakeTimers()
      // Current time: 2024-01-15 18:00:00 UTC
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 18, 0, 0)))

      const result = parseQuotaResetTime('resets 3pm (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCDate()).toBe(16)
      expect(result!.getUTCHours()).toBe(15)
    })

    it('QM-032: exact same time wraps to next day', () => {
      vi.useFakeTimers()
      // Current time: 2024-01-15 15:00:00 UTC exactly
      vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 15, 0, 0)))

      const result = parseQuotaResetTime('resets 3pm (UTC)')
      expect(result).not.toBeNull()
      expect(result!.getUTCDate()).toBe(16)
      expect(result!.getUTCHours()).toBe(15)
    })
  })
})

describe('calculateWaitDuration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.UTC(2024, 0, 15, 10, 0, 0)))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('QM-040: future time returns positive duration', () => {
    const futureTime = new Date(Date.now() + 60000)
    expect(calculateWaitDuration(futureTime)).toBe(60000)
  })

  it('QM-041: past time returns 0', () => {
    const pastTime = new Date(Date.now() - 10000)
    expect(calculateWaitDuration(pastTime)).toBe(0)
  })

  it('QM-042: exact now returns 0', () => {
    const now = new Date(Date.now())
    expect(calculateWaitDuration(now)).toBe(0)
  })
})
