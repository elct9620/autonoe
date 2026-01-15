import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Logger } from '@autonoe/core'
import {
  validateProjectDir,
  parseNumericOption,
  parseThinkingOption,
  validateCommonOptions,
  validateSyncOptions,
  validateRunOptions,
  logSecurityWarnings,
  SandboxMode,
} from '../src/options'

function createMockLogger(): Logger & { warnMessages: string[] } {
  const warnMessages: string[] = []
  return {
    warnMessages,
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn((msg: string) => warnMessages.push(msg)),
    error: vi.fn(),
  }
}

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
      error: 'Thinking budget must be at least 1024 tokens, got 512',
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

describe('SandboxMode', () => {
  describe('static enabled()', () => {
    it('OPT-060: creates enabled sandbox mode', () => {
      const mode = SandboxMode.enabled()
      expect(mode.disabled).toBe(false)
      expect(mode.enabled).toBe(true)
      expect(mode.source).toBe('default')
    })
  })

  describe('static disabledByCli()', () => {
    it('OPT-061: creates disabled sandbox mode with cli source', () => {
      const mode = SandboxMode.disabledByCli()
      expect(mode.disabled).toBe(true)
      expect(mode.enabled).toBe(false)
      expect(mode.source).toBe('cli')
    })
  })

  describe('static disabledByEnv()', () => {
    it('OPT-062: creates disabled sandbox mode with env source', () => {
      const mode = SandboxMode.disabledByEnv()
      expect(mode.disabled).toBe(true)
      expect(mode.enabled).toBe(false)
      expect(mode.source).toBe('env')
    })
  })

  describe('static fromCliAndEnv()', () => {
    it('OPT-063: CLI flag takes priority over env', () => {
      const result = SandboxMode.fromCliAndEnv(false, {
        AUTONOE_NO_SANDBOX: '1',
      })
      expect(result.disabled).toBe(true)
      expect(result.source).toBe('cli')
    })

    it('OPT-064: uses env when no CLI flag', () => {
      const result = SandboxMode.fromCliAndEnv(undefined, {
        AUTONOE_NO_SANDBOX: '1',
      })
      expect(result.disabled).toBe(true)
      expect(result.source).toBe('env')
    })

    it('OPT-065: returns default when neither set', () => {
      const result = SandboxMode.fromCliAndEnv(undefined, {})
      expect(result.disabled).toBe(false)
      expect(result.source).toBe('default')
    })

    it('OPT-066: env value must be exactly "1"', () => {
      const result = SandboxMode.fromCliAndEnv(undefined, {
        AUTONOE_NO_SANDBOX: 'true',
      })
      expect(result.disabled).toBe(false)
      expect(result.source).toBe('default')
    })
  })

  describe('getWarningMessage()', () => {
    it('OPT-067: returns undefined when enabled', () => {
      const mode = SandboxMode.enabled()
      expect(mode.getWarningMessage()).toBeUndefined()
    })

    it('OPT-068: returns CLI warning when disabled by CLI', () => {
      const mode = SandboxMode.disabledByCli()
      expect(mode.getWarningMessage()).toBe(
        'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
      )
    })

    it('OPT-069: returns env warning when disabled by env', () => {
      const mode = SandboxMode.disabledByEnv()
      expect(mode.getWarningMessage()).toBe(
        'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.',
      )
    })
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
      expect(result.options.sandboxMode.disabled).toBe(true)
      expect(result.options.sandboxMode.source).toBe('env')
    }
  })

  it('OPT-046: CLI flag overrides env for sandbox', () => {
    const result = validateRunOptions(
      { projectDir: tempDir, sandbox: false },
      {}, // env does not disable sandbox
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.sandboxMode.disabled).toBe(true)
      expect(result.options.sandboxMode.source).toBe('cli')
    }
  })

  it('OPT-047: CLI flag takes priority over env when both set', () => {
    const result = validateRunOptions(
      { projectDir: tempDir, sandbox: false },
      { AUTONOE_NO_SANDBOX: '1' }, // env also disables, but CLI should win
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.sandboxMode.disabled).toBe(true)
      expect(result.options.sandboxMode.source).toBe('cli')
    }
  })
})

describe('logSecurityWarnings', () => {
  it('OPT-050: logs CLI sandbox warning when disabled via CLI', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, SandboxMode.disabledByCli(), false)
    expect(logger.warn).toHaveBeenCalledWith(
      'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
    )
  })

  it('OPT-051: logs env sandbox warning when disabled via env', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, SandboxMode.disabledByEnv(), false)
    expect(logger.warn).toHaveBeenCalledWith(
      'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.',
    )
  })

  it('OPT-052: logs destructive warning when enabled', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, SandboxMode.enabled(), true)
    expect(logger.warn).toHaveBeenCalledWith(
      'Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.',
    )
  })

  it('OPT-053: logs nothing when sandbox enabled and no destructive', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, SandboxMode.enabled(), false)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('OPT-054: logs both warnings when sandbox disabled and destructive enabled', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, SandboxMode.disabledByCli(), true)
    expect(logger.warn).toHaveBeenCalledTimes(2)
  })
})

describe('validateCommonOptions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('OPT-070: returns error for non-existent project dir', () => {
    const result = validateCommonOptions({ projectDir: '/non/existent' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('does not exist')
    }
  })

  it('OPT-071: returns validated options for valid input', () => {
    const result = validateCommonOptions({ projectDir: tempDir })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.projectDir).toBe(tempDir)
    }
  })

  it('OPT-072: parses all numeric options', () => {
    const result = validateCommonOptions({
      projectDir: tempDir,
      maxIterations: '10',
      maxRetries: '3',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.maxIterations).toBe(10)
      expect(result.options.maxRetries).toBe(3)
    }
  })

  it('OPT-073: sets default values for boolean options', () => {
    const result = validateCommonOptions({ projectDir: tempDir })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.debug).toBe(false)
      expect(result.options.waitForQuota).toBe(false)
    }
  })

  it('OPT-074: returns error for invalid thinking budget', () => {
    const result = validateCommonOptions({
      projectDir: tempDir,
      thinking: '100',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('1024')
    }
  })

  it('OPT-075: respects sandbox mode from env', () => {
    const result = validateCommonOptions(
      { projectDir: tempDir },
      { AUTONOE_NO_SANDBOX: '1' },
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.sandboxMode.disabled).toBe(true)
      expect(result.options.sandboxMode.source).toBe('env')
    }
  })

  it('OPT-076: defaults to enabled sandbox when env not set', () => {
    const result = validateCommonOptions({ projectDir: tempDir }, {})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.sandboxMode.enabled).toBe(true)
      expect(result.options.sandboxMode.source).toBe('default')
    }
  })
})

describe('validateSyncOptions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('OPT-080: respects sandbox mode from env', () => {
    const result = validateSyncOptions(
      { projectDir: tempDir },
      { AUTONOE_NO_SANDBOX: '1' },
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.sandboxMode.disabled).toBe(true)
      expect(result.options.sandboxMode.source).toBe('env')
    }
  })

  it('OPT-081: defaults to enabled sandbox when env not set', () => {
    const result = validateSyncOptions({ projectDir: tempDir }, {})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.options.sandboxMode.enabled).toBe(true)
    }
  })
})
