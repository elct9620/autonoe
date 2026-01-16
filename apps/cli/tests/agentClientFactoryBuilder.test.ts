import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SECURITY_BASELINE,
  Deliverable,
  DeliverableStatus,
} from '@autonoe/core'
import { AgentClientFactoryBuilder } from '../src/agentClientFactoryBuilder'
import { SandboxMode } from '../src/options'

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

describe('AgentClientFactoryBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('build validation', () => {
    it('AFB-010: throws when projectDir is missing', () => {
      const builder = new AgentClientFactoryBuilder()
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withRunMode(false)

      expect(() => builder.build()).toThrow(
        'AgentClientFactoryBuilder: projectDir is required',
      )
    })

    it('AFB-011: throws when config is missing', () => {
      const builder = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withRunMode(false)

      expect(() => builder.build()).toThrow(
        'AgentClientFactoryBuilder: config is required',
      )
    })

    it('AFB-012: throws when repository is missing', () => {
      const builder = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withSandboxMode(SandboxMode.enabled())
        .withRunMode(false)

      expect(() => builder.build()).toThrow(
        'AgentClientFactoryBuilder: repository is required',
      )
    })

    it('AFB-013: throws when mode is not set', () => {
      const builder = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())

      expect(() => builder.build()).toThrow(
        'AgentClientFactoryBuilder: mode is required',
      )
    })
  })

  describe('withRunMode', () => {
    it('AFB-001: creates factory with run-specific hooks when allowDestructive=false', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withRunMode(false)
        .build()

      expect(result.factory).toBeDefined()
      expect(result.factory.create).toBeInstanceOf(Function)
      expect(result.getVerificationTracker).toBeUndefined()
    })

    it('AFB-002: creates factory with allowDestructive enabled', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withRunMode(true)
        .build()

      expect(result.factory).toBeDefined()
      // The allowDestructive setting is internal to BashSecurity
      // We verify the factory is created successfully
    })
  })

  describe('withSyncMode', () => {
    it('AFB-003: creates factory with sync-specific hooks', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withSyncMode()
        .build()

      expect(result.factory).toBeDefined()
      expect(result.getVerificationTracker).toBeInstanceOf(Function)
    })

    it('AFB-004: initializes VerificationTracker on first verify session', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withSyncMode()
        .build()

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

  describe('withSandboxMode', () => {
    it('AFB-020: passes sandbox config when enabled', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withRunMode(false)
        .build()

      const client = result.factory.create('coding') as any
      expect(client.options.sandbox).toEqual({
        enabled: true,
        autoAllowBashIfSandboxed: true,
      })
    })

    it('AFB-021: passes undefined when sandbox disabled', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.disabledByCli())
        .withRunMode(false)
        .build()

      const client = result.factory.create('coding') as any
      expect(client.options.sandbox).toBeUndefined()
    })
  })

  describe('optional configurations', () => {
    it('AFB-030: passes model to client', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withModel('claude-sonnet-4')
        .withRunMode(false)
        .build()

      const client = result.factory.create('coding') as any
      expect(client.options.model).toBe('claude-sonnet-4')
    })

    it('AFB-031: passes maxThinkingTokens to client', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withMaxThinkingTokens(8192)
        .withRunMode(false)
        .build()

      const client = result.factory.create('coding') as any
      expect(client.options.maxThinkingTokens).toBe(8192)
    })
  })

  describe('fluent interface', () => {
    it('returns this from all with* methods', () => {
      const builder = new AgentClientFactoryBuilder()

      expect(builder.withProjectDir('/test')).toBe(builder)
      expect(builder.withConfig(mockConfig)).toBe(builder)
      expect(builder.withRepository(mockRepository)).toBe(builder)
      expect(builder.withSandboxMode(SandboxMode.enabled())).toBe(builder)
      expect(builder.withModel('claude-sonnet-4')).toBe(builder)
      expect(builder.withMaxThinkingTokens(8192)).toBe(builder)
      expect(builder.withRunMode(false)).toBe(builder)
    })

    it('withSyncMode resets allowDestructive', () => {
      const result = new AgentClientFactoryBuilder()
        .withProjectDir('/test')
        .withConfig(mockConfig)
        .withRepository(mockRepository)
        .withSandboxMode(SandboxMode.enabled())
        .withRunMode(true) // Set allowDestructive
        .withSyncMode() // Should reset to sync mode
        .build()

      // Verify it's a sync factory (has getVerificationTracker)
      expect(result.getVerificationTracker).toBeInstanceOf(Function)
    })
  })
})
