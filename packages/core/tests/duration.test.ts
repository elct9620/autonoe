import { describe, it, expect } from 'vitest'
import { formatDuration } from '../src/duration'

/**
 * Duration Format Tests
 * @see SPEC.md Section 8.9
 */
describe('formatDuration', () => {
  it('DU-001: formats 0ms as "0s"', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('DU-002: formats 5000ms as "5s"', () => {
    expect(formatDuration(5000)).toBe('5s')
  })

  it('DU-003: formats 60000ms as "1m"', () => {
    expect(formatDuration(60000)).toBe('1m')
  })

  it('DU-004: formats 90000ms as "1m 30s"', () => {
    expect(formatDuration(90000)).toBe('1m 30s')
  })

  it('DU-005: formats 3600000ms as "1h"', () => {
    expect(formatDuration(3600000)).toBe('1h')
  })

  it('DU-006: formats 3661000ms as "1h 1m 1s"', () => {
    expect(formatDuration(3661000)).toBe('1h 1m 1s')
  })

  it('DU-007: formats 3660000ms as "1h 1m"', () => {
    expect(formatDuration(3660000)).toBe('1h 1m')
  })

  it('handles hours only with no minutes or seconds', () => {
    expect(formatDuration(7200000)).toBe('2h')
  })

  it('handles hours and seconds with no minutes', () => {
    expect(formatDuration(3630000)).toBe('1h 30s')
  })

  it('handles sub-second values as 0s', () => {
    expect(formatDuration(500)).toBe('0s')
  })
})
