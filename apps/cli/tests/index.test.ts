import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  handleRunCommand,
  handleSyncCommand,
  type ProcessExitStrategy,
} from '../src/index'

// Mock ConsoleLogger to suppress output during tests
vi.mock('../src/consoleLogger', () => {
  return {
    ConsoleLogger: class MockConsoleLogger {
      constructor(_options?: any) {}
      info() {}
      error() {}
      debug() {}
      warn() {}
    },
  }
})

// Mock @autonoe/agent to avoid SDK calls
vi.mock('@autonoe/agent', () => {
  return {
    ClaudeAgentClient: class MockClaudeAgentClient {
      options: any
      constructor(options: any) {
        this.options = options
      }
      query() {
        return (async function* () {
          yield { type: 'stream_end', outcome: 'completed', totalCostUsd: 0.01 }
        })()
      }
      dispose() {
        return Promise.resolve()
      }
    },
    FileDeliverableRepository: class MockFileDeliverableRepository {
      constructor(_dir: string) {}
      loadSync() {
        return null
      }
      load() {
        return Promise.resolve(null)
      }
      save() {
        return Promise.resolve()
      }
    },
    createDeliverableMcpServer: vi.fn().mockReturnValue({
      server: { name: 'mock-server' },
      allowedTools: ['mock-tool'],
    }),
  }
})

// Mock @autonoe/core SessionRunner to avoid actual execution
vi.mock('@autonoe/core', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    SessionRunner: class MockSessionRunner {
      options: any
      constructor(options: any) {
        this.options = options
      }
      async run() {
        return {
          success: true,
          exitReason: 'all_passed',
          iterations: 1,
          totalCostUsd: 0.01,
          durationMs: 1000,
        }
      }
    },
  }
})

// Create a mock ProcessExitStrategy that captures exit calls
function createMockProcessExit(): ProcessExitStrategy & {
  exitCode: number | null
} {
  const mock = {
    exitCode: null as number | null,
    exit(code: number): never {
      mock.exitCode = code
      throw new Error(`process.exit(${code})`)
    },
  }
  return mock
}

describe('handleRunCommand', () => {
  let testDir: string
  let mockExit: ReturnType<typeof createMockProcessExit>

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `autonoe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    mkdirSync(testDir, { recursive: true })
    mockExit = createMockProcessExit()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('validation scenarios', () => {
    it('CMD-001: exits with code 1 when project dir does not exist', async () => {
      const nonExistentDir = join(testDir, 'non-existent')

      await expect(
        handleRunCommand({ projectDir: nonExistentDir }, mockExit),
      ).rejects.toThrow('process.exit(1)')

      expect(mockExit.exitCode).toBe(1)
    })

    it('CMD-002: exits with code 1 when SPEC.md is missing', async () => {
      // Project dir exists but no SPEC.md
      await expect(
        handleRunCommand({ projectDir: testDir }, mockExit),
      ).rejects.toThrow('process.exit(1)')

      expect(mockExit.exitCode).toBe(1)
    })
  })

  describe('successful execution', () => {
    beforeEach(() => {
      // Create SPEC.md for valid project
      writeFileSync(join(testDir, 'SPEC.md'), '# Test Spec')
    })

    it('CMD-010: completes successfully with valid project', async () => {
      // Should not throw with valid setup
      await handleRunCommand({ projectDir: testDir }, mockExit)

      // Should not call exit on success
      expect(mockExit.exitCode).toBeNull()
    })
  })

  describe('dependency injection', () => {
    it('CMD-040: uses mock ProcessExitStrategy when provided', async () => {
      const nonExistentDir = join(testDir, 'non-existent')

      await expect(
        handleRunCommand({ projectDir: nonExistentDir }, mockExit),
      ).rejects.toThrow()

      // Verify our mock was used, not actual process.exit
      expect(mockExit.exitCode).toBe(1)
    })
  })
})

describe('handleSyncCommand', () => {
  let testDir: string
  let mockExit: ReturnType<typeof createMockProcessExit>

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `autonoe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    mkdirSync(testDir, { recursive: true })
    mockExit = createMockProcessExit()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('validation scenarios', () => {
    it('CMD-003: exits with code 1 when project dir does not exist', async () => {
      const nonExistentDir = join(testDir, 'non-existent')

      await expect(
        handleSyncCommand({ projectDir: nonExistentDir }, mockExit),
      ).rejects.toThrow('process.exit(1)')

      expect(mockExit.exitCode).toBe(1)
    })

    it('CMD-004: exits with code 1 when SPEC.md is missing', async () => {
      await expect(
        handleSyncCommand({ projectDir: testDir }, mockExit),
      ).rejects.toThrow('process.exit(1)')

      expect(mockExit.exitCode).toBe(1)
    })
  })

  describe('successful execution', () => {
    beforeEach(() => {
      writeFileSync(join(testDir, 'SPEC.md'), '# Test Spec')
    })

    it('CMD-012: completes successfully with valid project', async () => {
      await handleSyncCommand({ projectDir: testDir }, mockExit)

      expect(mockExit.exitCode).toBeNull()
    })
  })

  describe('dependency injection', () => {
    it('CMD-041: uses mock ProcessExitStrategy when provided', async () => {
      const nonExistentDir = join(testDir, 'non-existent')

      await expect(
        handleSyncCommand({ projectDir: nonExistentDir }, mockExit),
      ).rejects.toThrow()

      expect(mockExit.exitCode).toBe(1)
    })
  })
})
