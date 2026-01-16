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
  sandboxEnabled,
  sandboxDisabledByCli,
  sandboxDisabledByEnv,
  createSandboxMode,
  getSandboxWarningMessage,
  checkSpecExists,
  validatePrerequisites,
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
  it('SC-V003/OPT-020: returns enabled with 8192 for boolean true', () => {
    const result = parseThinkingOption(true)
    expect(result).toEqual({ type: 'enabled', tokens: 8192 })
  })

  it('OPT-021: returns enabled with parsed number for string', () => {
    const result = parseThinkingOption('16384')
    expect(result).toEqual({ type: 'enabled', tokens: 16384 })
  })

  it('SC-V002/OPT-022: returns error for value below minimum', () => {
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

  it('SC-V001/OPT-026: accepts minimum value 1024', () => {
    const result = parseThinkingOption('1024')
    expect(result).toEqual({ type: 'enabled', tokens: 1024 })
  })
})

describe('SandboxMode factory functions', () => {
  describe('sandboxEnabled()', () => {
    it('OPT-060: creates enabled sandbox mode', () => {
      const mode = sandboxEnabled()
      expect(mode.disabled).toBe(false)
      expect(mode.source).toBe('default')
    })
  })

  describe('sandboxDisabledByCli()', () => {
    it('OPT-061: creates disabled sandbox mode with cli source', () => {
      const mode = sandboxDisabledByCli()
      expect(mode.disabled).toBe(true)
      expect(mode.source).toBe('cli')
    })
  })

  describe('sandboxDisabledByEnv()', () => {
    it('OPT-062: creates disabled sandbox mode with env source', () => {
      const mode = sandboxDisabledByEnv()
      expect(mode.disabled).toBe(true)
      expect(mode.source).toBe('env')
    })
  })

  describe('createSandboxMode()', () => {
    it('OPT-063: CLI flag takes priority over env', () => {
      const result = createSandboxMode(false, {
        AUTONOE_NO_SANDBOX: '1',
      })
      expect(result.disabled).toBe(true)
      expect(result.source).toBe('cli')
    })

    it('OPT-064: uses env when no CLI flag', () => {
      const result = createSandboxMode(undefined, {
        AUTONOE_NO_SANDBOX: '1',
      })
      expect(result.disabled).toBe(true)
      expect(result.source).toBe('env')
    })

    it('OPT-065: returns default when neither set', () => {
      const result = createSandboxMode(undefined, {})
      expect(result.disabled).toBe(false)
      expect(result.source).toBe('default')
    })

    it('OPT-066: env value must be exactly "1"', () => {
      const result = createSandboxMode(undefined, {
        AUTONOE_NO_SANDBOX: 'true',
      })
      expect(result.disabled).toBe(false)
      expect(result.source).toBe('default')
    })
  })

  describe('getSandboxWarningMessage()', () => {
    it('OPT-067: returns undefined when enabled', () => {
      const mode = sandboxEnabled()
      expect(getSandboxWarningMessage(mode)).toBeUndefined()
    })

    it('OPT-068: returns CLI warning when disabled by CLI', () => {
      const mode = sandboxDisabledByCli()
      expect(getSandboxWarningMessage(mode)).toBe(
        'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
      )
    })

    it('OPT-069: returns env warning when disabled by env', () => {
      const mode = sandboxDisabledByEnv()
      expect(getSandboxWarningMessage(mode)).toBe(
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
    logSecurityWarnings(logger, sandboxDisabledByCli(), false)
    expect(logger.warn).toHaveBeenCalledWith(
      'Warning: SDK sandbox is disabled. System-level isolation is not enforced.',
    )
  })

  it('OPT-051: logs env sandbox warning when disabled via env', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, sandboxDisabledByEnv(), false)
    expect(logger.warn).toHaveBeenCalledWith(
      'Warning: SDK sandbox disabled via AUTONOE_NO_SANDBOX environment variable.',
    )
  })

  it('OPT-052: logs destructive warning when enabled', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, sandboxEnabled(), true)
    expect(logger.warn).toHaveBeenCalledWith(
      'Warning: Destructive commands (rm, mv) enabled. Files can be deleted within project directory.',
    )
  })

  it('OPT-053: logs nothing when sandbox enabled and no destructive', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, sandboxEnabled(), false)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('OPT-054: logs both warnings when sandbox disabled and destructive enabled', () => {
    const logger = createMockLogger()
    logSecurityWarnings(logger, sandboxDisabledByCli(), true)
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
      expect(result.options.sandboxMode.disabled).toBe(false)
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
      expect(result.options.sandboxMode.disabled).toBe(false)
    }
  })
})

describe('checkSpecExists', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('SC-P003: returns true when SPEC.md exists', () => {
    writeFileSync(join(tempDir, 'SPEC.md'), '# Spec')
    expect(checkSpecExists(tempDir)).toBe(true)
  })

  it('returns false when SPEC.md does not exist', () => {
    expect(checkSpecExists(tempDir)).toBe(false)
  })
})

describe('validatePrerequisites', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('SC-P001/SC-P002: returns error when SPEC.md not found', () => {
    const result = validatePrerequisites(tempDir)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe(`SPEC.md not found in ${tempDir}`)
    }
  })

  it('SC-P003: returns success when SPEC.md exists', () => {
    writeFileSync(join(tempDir, 'SPEC.md'), '# Spec')
    const result = validatePrerequisites(tempDir)
    expect(result.success).toBe(true)
  })
})

describe('Option Validation Constraints', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('maxIterations constraint', () => {
    it('SC-V004: accepts positive value', () => {
      const result = validateCommonOptions({
        projectDir: tempDir,
        maxIterations: '1',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.options.maxIterations).toBe(1)
      }
    })

    it('SC-V005: rejects zero value', () => {
      const result = validateCommonOptions({
        projectDir: tempDir,
        maxIterations: '0',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Max iterations must be positive, got 0')
      }
    })

    it('SC-V006: rejects negative value', () => {
      const result = validateCommonOptions({
        projectDir: tempDir,
        maxIterations: '-1',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Max iterations must be positive, got -1')
      }
    })
  })

  describe('maxRetries constraint', () => {
    it('SC-V007: accepts zero value (no retries)', () => {
      const result = validateCommonOptions({
        projectDir: tempDir,
        maxRetries: '0',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.options.maxRetries).toBe(0)
      }
    })

    it('SC-V008: rejects negative value', () => {
      const result = validateCommonOptions({
        projectDir: tempDir,
        maxRetries: '-1',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Max retries must be non-negative, got -1')
      }
    })

    it('accepts positive value', () => {
      const result = validateCommonOptions({
        projectDir: tempDir,
        maxRetries: '5',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.options.maxRetries).toBe(5)
      }
    })
  })
})
