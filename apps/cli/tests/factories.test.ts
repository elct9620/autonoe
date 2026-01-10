import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initializerInstruction, codingInstruction } from '@autonoe/core'
import {
  createInstructionResolver,
  formatStatusIcon,
  createStatusChangeCallback,
  createRunnerOptions,
} from '../src/factories'
import { SandboxMode, type ValidatedRunOptions } from '../src/options'
import { ConsoleWaitProgressReporter } from '../src/consoleWaitProgressReporter'

describe('createInstructionResolver', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('FAC-001: returns override content when file exists', async () => {
    const autonoeDir = join(tempDir, '.autonoe')
    mkdirSync(autonoeDir, { recursive: true })
    writeFileSync(join(autonoeDir, 'initializer.md'), 'Custom initializer')

    const resolver = createInstructionResolver(tempDir)
    const result = await resolver.resolve('initializer')

    expect(result).toBe('Custom initializer')
  })

  it('FAC-002: returns default initializer instruction when override not found', async () => {
    const resolver = createInstructionResolver(tempDir)
    const result = await resolver.resolve('initializer')

    expect(result).toBe(initializerInstruction)
  })

  it('FAC-003: returns default coding instruction when override not found', async () => {
    const resolver = createInstructionResolver(tempDir)
    const result = await resolver.resolve('coding')

    expect(result).toBe(codingInstruction)
  })

  it('FAC-004: returns coding override when file exists', async () => {
    const autonoeDir = join(tempDir, '.autonoe')
    mkdirSync(autonoeDir, { recursive: true })
    writeFileSync(join(autonoeDir, 'coding.md'), 'Custom coding')

    const resolver = createInstructionResolver(tempDir)
    const result = await resolver.resolve('coding')

    expect(result).toBe('Custom coding')
  })
})

describe('formatStatusIcon', () => {
  it('FAC-010: returns [PASS] for passed status', () => {
    expect(formatStatusIcon('passed')).toBe('[PASS]')
  })

  it('FAC-011: returns [BLOCKED] for blocked status', () => {
    expect(formatStatusIcon('blocked')).toBe('[BLOCKED]')
  })

  it('FAC-012: returns [PENDING] for pending status', () => {
    expect(formatStatusIcon('pending')).toBe('[PENDING]')
  })
})

describe('createStatusChangeCallback', () => {
  it('FAC-020: logs formatted message with icon', () => {
    const mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    const callback = createStatusChangeCallback(mockLogger)
    callback({
      deliverableId: 'DL-001',
      deliverableDescription: 'Test deliverable',
      previousStatus: undefined,
      newStatus: 'passed',
    })

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[PASS] Test deliverable (DL-001)',
    )
  })

  it('FAC-021: logs blocked status correctly', () => {
    const mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    const callback = createStatusChangeCallback(mockLogger)
    callback({
      deliverableId: 'DL-002',
      deliverableDescription: 'Blocked task',
      previousStatus: 'pending',
      newStatus: 'blocked',
    })

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[BLOCKED] Blocked task (DL-002)',
    )
  })
})

describe('createRunnerOptions', () => {
  const baseOptions: ValidatedRunOptions = {
    projectDir: '/test/project',
    debug: false,
    sandboxMode: SandboxMode.enabled(),
    waitForQuota: false,
    allowDestructive: false,
  }

  it('FAC-030: builds options with required fields only', () => {
    const result = createRunnerOptions(baseOptions)

    expect(result).toEqual({
      projectDir: '/test/project',
      maxIterations: undefined,
      maxRetries: undefined,
      model: undefined,
      waitForQuota: false,
      maxThinkingTokens: undefined,
    })
  })

  it('FAC-031: builds options with all optional fields', () => {
    const options: ValidatedRunOptions = {
      ...baseOptions,
      maxIterations: 10,
      maxRetries: 5,
      model: 'claude-3-opus',
      waitForQuota: true,
      maxThinkingTokens: 16384,
    }

    const result = createRunnerOptions(options)

    expect(result).toMatchObject({
      projectDir: '/test/project',
      maxIterations: 10,
      maxRetries: 5,
      model: 'claude-3-opus',
      waitForQuota: true,
      maxThinkingTokens: 16384,
    })
    expect(result.waitProgressReporter).toBeInstanceOf(
      ConsoleWaitProgressReporter,
    )
  })

  it('FAC-032: excludes debug, sandboxMode, allowDestructive', () => {
    const options: ValidatedRunOptions = {
      ...baseOptions,
      debug: true,
      sandboxMode: SandboxMode.disabledByCli(),
      allowDestructive: true,
    }

    const result = createRunnerOptions(options)

    expect(result).not.toHaveProperty('debug')
    expect(result).not.toHaveProperty('sandboxMode')
    expect(result).not.toHaveProperty('allowDestructive')
  })
})
