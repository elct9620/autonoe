import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Logger } from '@autonoe/core'
import { SyncCommandHandler } from '../src/syncCommandHandler'
import type { ValidatedSyncOptions } from '../src/options'
import { VERSION } from '../src/version'

function createMockLogger(): Logger & {
  infoMessages: string[]
} {
  const infoMessages: string[] = []
  return {
    infoMessages,
    info: vi.fn((msg: string) => infoMessages.push(msg)),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

describe('SyncCommandHandler', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autonoe-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function createBaseOptions(): ValidatedSyncOptions {
    return {
      projectDir: tempDir,
      debug: false,
      waitForQuota: false,
    }
  }

  describe('execute', () => {
    it('SCH-001: logs startup info with version', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()

      const handler = new SyncCommandHandler(options, logger)
      await handler.execute()

      expect(logger.infoMessages).toContain(`Autonoe v${VERSION}`)
      expect(logger.infoMessages.some((m) => m.includes('Syncing'))).toBe(true)
      expect(logger.infoMessages.some((m) => m.includes(tempDir))).toBe(true)
    })

    it('SCH-002: logs dummy implementation message', async () => {
      const options = createBaseOptions()
      const logger = createMockLogger()

      const handler = new SyncCommandHandler(options, logger)
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('not yet implemented')),
      ).toBe(true)
    })

    it('SCH-003: logs max iterations when specified', async () => {
      const options = { ...createBaseOptions(), maxIterations: 5 }
      const logger = createMockLogger()

      const handler = new SyncCommandHandler(options, logger)
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Max iterations: 5')),
      ).toBe(true)
    })

    it('SCH-004: logs model when specified', async () => {
      const options = { ...createBaseOptions(), model: 'claude-3-opus' }
      const logger = createMockLogger()

      const handler = new SyncCommandHandler(options, logger)
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Model: claude-3-opus')),
      ).toBe(true)
    })

    it('SCH-005: logs thinking tokens when specified', async () => {
      const options = { ...createBaseOptions(), maxThinkingTokens: 16384 }
      const logger = createMockLogger()

      const handler = new SyncCommandHandler(options, logger)
      await handler.execute()

      expect(
        logger.infoMessages.some((m) => m.includes('Thinking: 16384 tokens')),
      ).toBe(true)
    })
  })
})
