import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  validateProjectDir,
  parseNumericOption,
  parseThinkingOption,
  determineSandboxMode,
  validateRunOptions,
  logSecurityWarnings,
} from '../src/options'

describe('validateProjectDir', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('OPT-001: returns false for non-existent path', () => {
    expect(validateProjectDir('/non/existent/path')).toBe(false)
  })

  it('OPT-002: returns false for file path', () => {
    const filePath = join(tempDir, 'file.txt')
    writeFileSync(filePath, 'test')
    expect(validateProjectDir(filePath)).toBe(false)
  })

  it('OPT-003: returns true for directory', () => {
    expect(validateProjectDir(tempDir)).toBe(true)
  })
})

describe('parseNumericOption', () => {
  it('OPT-010: returns undefined for undefined', () => {
    expect(parseNumericOption(undefined)).toBeUndefined()
  })

  it('OPT-011: returns number for valid string', () => {
    expect(parseNumericOption('42')).toBe(42)
  })

  it('OPT-012: returns undefined for NaN result', () => {
    expect(parseNumericOption('abc')).toBeUndefined()
  })

  it('OPT-013: returns undefined for empty string', () => {
    expect(parseNumericOption('')).toBeUndefined()
  })

  it('OPT-014: parses negative numbers', () => {
    expect(parseNumericOption('-5')).toBe(-5)
  })

  it('OPT-015: truncates decimal numbers', () => {
    expect(parseNumericOption('3.14')).toBe(3)
  })
})

describe('parseThinkingOption', () => {
  it('OPT-020: returns enabled with 8192 for boolean true', () => {
    const result = parseThinkingOption(true)
    expect(result).toEqual({ type: 'enabled', tokens: 8192 })
  })

  it('OPT-021: returns enabled with parsed number for string', () => {
    const result = parseThinkingOption('16384')
    expect(result).toEqual({ type: 'enabled', tokens: 16384 })
  })

  it('OPT-022: returns error for value below minimum', () => {
    const result = parseThinkingOption('512')
    expect(result).toEqual({
      type: 'error',
      error: 'Thinking budget must be at least 1024 tokens',
    })
  })

  it('OPT-023: returns disabled for undefined', () => {
    const result = parseThinkingOption(undefined)
    expect(result).toEqual({ type: 'disabled' })
  })

  it('OPT-024: returns disabled for false', () => {
    const result = parseThinkingOption(false)
    expect(result).toEqual({ type: 'disabled' })
  })

  it('OPT-025: returns error for non-numeric string', () => {
    const result = parseThinkingOption('abc')
    expect(result).toEqual({
      type: 'error',
      error: 'Invalid thinking budget: abc',
    })
  })

  it('OPT-026: accepts minimum value 1024', () => {
    const result = parseThinkingOption('1024')
    expect(result).toEqual({ type: 'enabled', tokens: 1024 })
  })
})

describe('determineSandboxMode', () => {
  it('OPT-030: CLI flag takes priority over env', () => {
    const result = determineSandboxMode(false, { AUTONOE_NO_SANDBOX: '1' })
    expect(result).toEqual({ disabled: true, source: 'cli' })
  })

  it('OPT-031: uses env when no CLI flag', () => {
    const result = determineSandboxMode(undefined, { AUTONOE_NO_SANDBOX: '1' })
    expect(result).toEqual({ disabled: true, source: 'env' })
  })

  it('OPT-032: returns default when neither set', () => {
    const result = determineSandboxMode(undefined, {})
    expect(result).toEqual({ disabled: false, source: 'default' })
  })

  it('OPT-033: env value must be exactly "1"', () => {
    const result = determineSandboxMode(undefined, {
      AUTONOE_NO_SANDBOX: 'true',
    })
    expect(result).toEqual({ disabled: false, source: 'default' })
  })
})

describe('validateRunOptions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('OPT-040: returns error for non-existent project dir', () => {
    const result = validateRunOptions({ projectDir: '/non/existent' }, {})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('does not exist')
    }
  })

  it('OPT-041: returns validated options for valid input', () => {
    const result = validateRunOptions({ projectDir: tempDir }, {})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.projectDir).toBe(tempDir)
    }
  })

  it('OPT-042: returns error for invalid thinking budget', () => {
    const result = validateRunOptions(
      { projectDir: tempDir, thinking: '100' },
      {},
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('1024')
    }
  })

  it('OPT-043: parses all numeric options', () => {
    const result = validateRunOptions(
      {
        projectDir: tempDir,
        maxIterations: '10',
        maxRetries: '3',
      },
      {},
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.maxIterations).toBe(10)
      expect(result.options.maxRetries).toBe(3)
    }
  })

  it('OPT-044: sets default values for boolean options', () => {
    const result = validateRunOptions({ projectDir: tempDir }, {})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.debug).toBe(false)
      expect(result.options.waitForQuota).toBe(false)
      expect(result.options.allowDestructive).toBe(false)
    }
  })

  it('OPT-045: respects sandbox mode from env', () => {
    const result = validateRunOptions(
      { projectDir: tempDir },
      { AUTONOE_NO_SANDBOX: '1' },
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.sandboxDisabled).toBe(true)
      expect(result.options.sandboxSource).toBe('env')
    }
  })
})

describe('logSecurityWarnings', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('OPT-050: logs CLI sandbox warning when disabled via CLI', () => {
    logSecurityWarnings({ disabled: true, source: 'cli' }, false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
    )
  })

  it('OPT-051: logs env sandbox warning when disabled via env', () => {
    logSecurityWarnings({ disabled: true, source: 'env' }, false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.',
    )
  })

  it('OPT-052: logs destructive warning when enabled', () => {
    logSecurityWarnings({ disabled: false, source: 'default' }, true)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.',
    )
  })

  it('OPT-053: logs nothing when sandbox enabled and no destructive', () => {
    logSecurityWarnings({ disabled: false, source: 'default' }, false)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('OPT-054: logs both warnings when sandbox disabled and destructive enabled', () => {
    logSecurityWarnings({ disabled: true, source: 'cli' }, true)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
  })
})
