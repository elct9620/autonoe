import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Query as SDKQuery } from '@anthropic-ai/claude-agent-sdk'
import type { PreToolUseHook } from '@autonoe/core'

// Mock SDK at module level
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

// Mock detectClaudeCodePath
vi.mock('../src/claudeCodePath', () => ({
  detectClaudeCodePath: vi.fn().mockReturnValue('/usr/local/bin/claude'),
}))

/**
 * Create a mock SDK Query that returns empty async iterator
 */
function createMockSdkQuery(): SDKQuery {
  const generator = (async function* () {
    // Empty - no events
  })()
  const query = generator as SDKQuery
  query.interrupt = vi.fn().mockResolvedValue(undefined)
  return query
}

/**
 * Captured SDK options type for assertions
 */
interface CapturedSdkOptions {
  cwd?: string
  model?: string
  permissionMode?: string
  allowedTools?: string[]
  sandbox?: { enabled: boolean; autoAllowBashIfSandboxed: boolean }
  mcpServers?: Record<string, unknown>
  hooks?: { PreToolUse?: Array<{ matcher?: string }> }
  maxThinkingTokens?: number
  [key: string]: unknown
}

/**
 * Extract SDK options from the mock query call
 * Throws if no call was made (test setup error)
 */
function getCapturedSdkOptions(
  mock: ReturnType<typeof vi.fn>,
): CapturedSdkOptions {
  const calls = mock.mock.calls
  if (calls.length === 0) {
    throw new Error('No SDK query calls captured')
  }
  const call = calls[0]?.[0] as { options: CapturedSdkOptions } | undefined
  if (!call) {
    throw new Error('Invalid SDK query call structure')
  }
  return call.options
}

describe('ClaudeAgentClient', () => {
  let sdkQueryMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    // Import after mocking
    const sdk = await import('@anthropic-ai/claude-agent-sdk')
    sdkQueryMock = vi.mocked(sdk.query)
    sdkQueryMock.mockReturnValue(createMockSdkQuery())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('query() SDK options assembly', () => {
    describe('base options', () => {
      it('SC-CAC001: passes cwd from options', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({ cwd: '/my/project' })

        client.query('test')

        expect(sdkQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              cwd: '/my/project',
            }),
          }),
        )
      })

      it('SC-CAC002: passes model from options', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({
          cwd: '/project',
          model: 'claude-sonnet-4-20250514',
        })

        client.query('test')

        expect(sdkQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              model: 'claude-sonnet-4-20250514',
            }),
          }),
        )
      })
    })

    describe('MCP servers merging', () => {
      it('SC-CAC010: no mcpServers when both undefined', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({ cwd: '/project' })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.mcpServers).toBeUndefined()
      })

      it('SC-CAC011: converts mcpServers via toSdkMcpServers', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({
          cwd: '/project',
          mcpServers: {
            external: { command: 'npx', args: ['external-mcp'] },
          },
        })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.mcpServers).toEqual({
          external: { command: 'npx', args: ['external-mcp'] },
        })
      })

      it('SC-CAC012: converts sdkMcpServers to record format', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const mockInstance = { start: vi.fn(), stop: vi.fn() }

        const client = new ClaudeAgentClient({
          cwd: '/project',
          sdkMcpServers: [
            {
              name: 'sdk-server',
              type: 'sdk' as const,
              instance: mockInstance,
            },
          ],
        })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        const mcpServers = options.mcpServers as Record<
          string,
          { name: string }
        >
        expect(mcpServers).toHaveProperty('sdk-server')
        expect(mcpServers['sdk-server']!.name).toBe('sdk-server')
      })

      it('SC-CAC013: merges external and SDK MCP servers, SDK takes precedence', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const mockInstance = { start: vi.fn(), stop: vi.fn() }

        const client = new ClaudeAgentClient({
          cwd: '/project',
          mcpServers: {
            external: { command: 'npx', args: ['external-mcp'] },
            shared: { command: 'old-cmd' },
          },
          sdkMcpServers: [
            {
              name: 'shared',
              type: 'sdk' as const,
              instance: mockInstance,
            },
          ],
        })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        const mcpServers = options.mcpServers as Record<
          string,
          { command?: string; args?: string[]; name?: string; type?: string }
        >
        // External server preserved
        expect(mcpServers.external).toEqual({
          command: 'npx',
          args: ['external-mcp'],
        })
        // SDK server overrides external with same name
        expect(mcpServers.shared!.name).toBe('shared')
        expect(mcpServers.shared!.type).toBe('sdk')
      })
    })

    describe('permissionLevel', () => {
      it('SC-CAC020: omits permissionMode when undefined', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({ cwd: '/project' })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.permissionMode).toBeUndefined()
      })

      it('SC-CAC021: sets permissionMode for acceptEdits', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({
          cwd: '/project',
          permissionLevel: 'acceptEdits',
        })

        client.query('test')

        expect(sdkQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              permissionMode: 'acceptEdits',
            }),
          }),
        )
      })
    })

    describe('allowedTools', () => {
      it('SC-CAC030: omits allowedTools when undefined', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({ cwd: '/project' })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.allowedTools).toBeUndefined()
      })

      it('SC-CAC031: passes allowedTools array', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({
          cwd: '/project',
          allowedTools: ['Read', 'Write', 'Bash'],
        })

        client.query('test')

        expect(sdkQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              allowedTools: ['Read', 'Write', 'Bash'],
            }),
          }),
        )
      })
    })

    describe('sandbox', () => {
      it('SC-CAC040: omits sandbox when undefined', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({ cwd: '/project' })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.sandbox).toBeUndefined()
      })

      it('SC-CAC041: passes sandbox with enabled and autoAllowBashIfSandboxed', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({
          cwd: '/project',
          sandbox: {
            enabled: true,
            autoAllowBashIfSandboxed: true,
          },
        })

        client.query('test')

        expect(sdkQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              sandbox: {
                enabled: true,
                autoAllowBashIfSandboxed: true,
              },
            }),
          }),
        )
      })
    })

    describe('preToolUseHooks', () => {
      it('SC-CAC050: omits hooks when undefined', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({ cwd: '/project' })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.hooks).toBeUndefined()
      })

      it('SC-CAC051: omits hooks when empty array', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({
          cwd: '/project',
          preToolUseHooks: [],
        })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.hooks).toBeUndefined()
      })

      it('SC-CAC052: converts hooks via toSdkHookCallbackMatchers', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const mockHook: PreToolUseHook = {
          name: 'test-hook',
          matcher: 'Bash',
          callback: vi.fn().mockResolvedValue({ continue: true }),
        }

        const client = new ClaudeAgentClient({
          cwd: '/project',
          preToolUseHooks: [mockHook],
        })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.hooks).toBeDefined()
        expect(options.hooks!.PreToolUse).toHaveLength(1)
        expect(options.hooks!.PreToolUse![0]!.matcher).toBe('Bash')
      })
    })

    describe('maxThinkingTokens', () => {
      it('SC-CAC060: omits maxThinkingTokens when undefined', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({ cwd: '/project' })

        client.query('test')

        const options = getCapturedSdkOptions(sdkQueryMock)
        expect(options.maxThinkingTokens).toBeUndefined()
      })

      it('SC-CAC061: passes maxThinkingTokens when set', async () => {
        const { ClaudeAgentClient } = await import('../src/claudeAgentClient')
        const client = new ClaudeAgentClient({
          cwd: '/project',
          maxThinkingTokens: 16384,
        })

        client.query('test')

        expect(sdkQueryMock).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              maxThinkingTokens: 16384,
            }),
          }),
        )
      })
    })
  })
})
