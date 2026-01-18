import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SECURITY_BASELINE,
  Deliverable,
  DeliverableStatus,
} from '@autonoe/core'
import { createAgentClientFactory } from '../src/agentClientFactory'
import {
  sandboxEnabled,
  sandboxDisabledByCli,
  DEFAULT_CODING_MODEL,
  DEFAULT_PLANNING_MODEL,
} from '../src/options'

// Mock @autonoe/agent
vi.mock('@autonoe/agent', () => {
  return {
    ClaudeAgentClient: class MockClaudeAgentClient {
      options: any
      constructor(options: any) {
        this.options = options
      }
      query() {}
      dispose() {}
    },
    createDeliverableMcpServer: vi.fn().mockReturnValue({
      server: { name: 'mock-server' },
      allowedTools: ['mock-tool'],
    }),
  }
})

// Create a proper DeliverableStatus instance for testing
function createMockStatus() {
  const deliverable = Deliverable.pending('DL-001', 'Test', ['AC1'])
  return DeliverableStatus.create('2025-01-01', '2025-01-01', [deliverable])
}

// Minimal mock repository
const mockRepository = {
  loadSync: vi.fn().mockImplementation(() => createMockStatus()),
  load: vi.fn(),
  save: vi.fn(),
} as any

// Minimal mock config
const mockConfig = {
  ...SECURITY_BASELINE,
  mcpServers: {},
}

describe('createAgentClientFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('run mode', () => {
    it('ACF-001: creates factory with run-specific hooks when allowDestructive=false', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
      })

      expect(result.factory).toBeDefined()
      expect(result.factory.create).toBeInstanceOf(Function)
      expect(result.getVerificationTracker).toBeUndefined()
    })

    it('ACF-002: creates factory with allowDestructive enabled', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
        allowDestructive: true,
      })

      expect(result.factory).toBeDefined()
    })
  })

  describe('sync mode', () => {
    it('ACF-003: creates factory with sync-specific hooks', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'sync',
      })

      expect(result.factory).toBeDefined()
      expect(result.getVerificationTracker).toBeInstanceOf(Function)
    })

    it('ACF-004: initializes VerificationTracker on first verify session', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'sync',
      })

      // Before any session, tracker should be undefined
      expect(result.getVerificationTracker?.()).toBeUndefined()

      // Create a sync session (not verify)
      result.factory.create('sync')
      expect(result.getVerificationTracker?.()).toBeUndefined()

      // Create a verify session - should initialize tracker
      result.factory.create('verify')
      expect(result.getVerificationTracker?.()).toBeDefined()
    })
  })

  describe('sandbox mode', () => {
    it('ACF-020: passes sandbox config when enabled', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
      })

      const client = result.factory.create('coding') as any
      expect(client.options.sandbox).toEqual({
        enabled: true,
        autoAllowBashIfSandboxed: true,
      })
    })

    it('ACF-021: passes undefined when sandbox disabled', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxDisabledByCli(),
        mode: 'run',
      })

      const client = result.factory.create('coding') as any
      expect(client.options.sandbox).toBeUndefined()
    })
  })

  describe('model selection', () => {
    it('ACF-030: uses planModel for initializer instruction', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
        model: 'sonnet',
        planModel: 'opus',
      })

      const client = result.factory.create('initializer') as any
      expect(client.options.model).toBe('opus')
    })

    it('ACF-031: uses model for coding instruction', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
        model: 'sonnet',
        planModel: 'opus',
      })

      const client = result.factory.create('coding') as any
      expect(client.options.model).toBe('sonnet')
    })

    it('ACF-032: uses planModel for sync instruction', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'sync',
        model: 'sonnet',
        planModel: 'opus',
      })

      const client = result.factory.create('sync') as any
      expect(client.options.model).toBe('opus')
    })

    it('ACF-033: uses model for verify instruction', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'sync',
        model: 'sonnet',
        planModel: 'opus',
      })

      const client = result.factory.create('verify') as any
      expect(client.options.model).toBe('sonnet')
    })

    it('ACF-034: defaults initializer to DEFAULT_PLANNING_MODEL when planModel not specified', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
      })

      const client = result.factory.create('initializer') as any
      expect(client.options.model).toBe(DEFAULT_PLANNING_MODEL)
    })

    it('ACF-035: defaults coding to DEFAULT_CODING_MODEL when model not specified', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
      })

      const client = result.factory.create('coding') as any
      expect(client.options.model).toBe(DEFAULT_CODING_MODEL)
    })
  })

  describe('optional configurations', () => {
    it('ACF-040: passes maxThinkingTokens to client', () => {
      const result = createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
        maxThinkingTokens: 8192,
      })

      const client = result.factory.create('coding') as any
      expect(client.options.maxThinkingTokens).toBe(8192)
    })

    it('ACF-041: passes onStatusChange callback', () => {
      const onStatusChange = vi.fn()
      createAgentClientFactory({
        projectDir: '/test',
        config: mockConfig,
        repository: mockRepository,
        sandboxMode: sandboxEnabled(),
        mode: 'run',
        onStatusChange,
      })

      // The callback is passed to createDeliverableMcpServer
      // We can verify by checking the mock was called
    })
  })
})
