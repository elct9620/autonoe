import { describe, it, expect, vi } from 'vitest'
import type { HookInput } from '@anthropic-ai/claude-agent-sdk'
import type { PreToolUseHook } from '@autonoe/core'
import {
  toSdkMcpServers,
  toStreamEvent,
  toSessionEnd,
  toStreamEvents,
  toSdkHookCallbackMatchers,
} from '../src/converters'

describe('converters', () => {
  describe('toSdkMcpServers', () => {
    it('SC-AC001: returns empty record for empty input', () => {
      const result = toSdkMcpServers({})
      expect(result).toEqual({})
    })

    it('SC-AC002: converts server with args to SDK format', () => {
      const input = {
        playwright: { command: 'npx', args: ['playwright-mcp'] },
      }
      const result = toSdkMcpServers(input)
      expect(result).toEqual({
        playwright: { command: 'npx', args: ['playwright-mcp'] },
      })
    })

    it('converts multiple servers', () => {
      const input = {
        server1: { command: 'cmd1' },
        server2: { command: 'cmd2', args: ['arg'] },
      }
      const result = toSdkMcpServers(input)
      expect(Object.keys(result)).toHaveLength(2)
      expect(result).toMatchObject({
        server1: { command: 'cmd1' },
        server2: { command: 'cmd2', args: ['arg'] },
      })
    })

    it('handles server without args', () => {
      const input = { simple: { command: 'simple-cmd' } }
      const result = toSdkMcpServers(input)
      expect(result).toEqual({
        simple: { command: 'simple-cmd', args: undefined },
      })
    })
  })

  describe('toStreamEvent', () => {
    it('converts text block to AgentText', () => {
      const block = { type: 'text', text: 'Hello' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_text',
        text: 'Hello',
      })
    })

    it('handles empty text', () => {
      const block = { type: 'text' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_text',
        text: '',
      })
    })

    it('converts tool_use block to ToolInvocation', () => {
      const block = {
        type: 'tool_use',
        name: 'bash',
        input: { command: 'ls' },
      }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_tool_invocation',
        name: 'bash',
        input: { command: 'ls' },
      })
    })

    it('handles tool_use with missing fields', () => {
      const block = { type: 'tool_use' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_tool_invocation',
        name: '',
        input: {},
      })
    })

    it('converts tool_result block with string content', () => {
      const block = {
        type: 'tool_result',
        tool_use_id: 'id-123',
        content: 'output',
        is_error: false,
      }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_tool_response',
        toolUseId: 'id-123',
        content: 'output',
        isError: false,
      })
    })

    it('converts tool_result block with array content', () => {
      const block = {
        type: 'tool_result',
        tool_use_id: 'id-123',
        content: [
          { type: 'text', text: 'part1' },
          { type: 'text', text: 'part2' },
        ],
        is_error: false,
      }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_tool_response',
        toolUseId: 'id-123',
        content: 'part1part2',
        isError: false,
      })
    })

    it('converts tool_result with is_error true', () => {
      const block = {
        type: 'tool_result',
        tool_use_id: 'id-123',
        content: 'error message',
        is_error: true,
      }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_tool_response',
        toolUseId: 'id-123',
        content: 'error message',
        isError: true,
      })
    })

    it('returns null for unknown block type', () => {
      const block = { type: 'unknown' }
      const result = toStreamEvent(block)
      expect(result).toBeNull()
    })

    it('converts thinking block to AgentThinking', () => {
      const block = { type: 'thinking', thinking: 'Let me analyze this...' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_thinking',
        thinking: 'Let me analyze this...',
      })
    })

    it('handles thinking block with empty content', () => {
      const block = { type: 'thinking' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'stream_thinking',
        thinking: '',
      })
    })
  })

  describe('toSessionEnd', () => {
    it('converts SDK success result to SessionEndCompleted', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        result: 'Done',
        total_cost_usd: 0.05,
      }
      const result = toSessionEnd(sdkMessage)
      expect(result).toEqual({
        type: 'stream_end',
        outcome: 'completed',
        result: 'Done',
        totalCostUsd: 0.05,
      })
    })

    it('converts error result to SessionEndExecutionError', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'error_during_execution',
        errors: ['Error 1', 'Error 2'],
      }
      const result = toSessionEnd(sdkMessage)
      expect(result).toEqual({
        type: 'stream_end',
        outcome: 'execution_error',
        messages: ['Error 1', 'Error 2'],
        totalCostUsd: undefined,
      })
    })

    it('converts max turns error to SessionEndMaxIterations', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'error_max_turns',
      }
      const result = toSessionEnd(sdkMessage)
      expect(result).toEqual({
        type: 'stream_end',
        outcome: 'max_iterations',
        totalCostUsd: undefined,
      })
    })

    it('converts budget exceeded to SessionEndBudgetExceeded', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'error_max_budget_usd',
      }
      const result = toSessionEnd(sdkMessage)
      expect(result).toEqual({
        type: 'stream_end',
        outcome: 'budget_exceeded',
        totalCostUsd: undefined,
      })
    })

    it('handles missing optional fields in success', () => {
      const sdkMessage = { type: 'result', subtype: 'success' }
      const result = toSessionEnd(sdkMessage)
      expect(result.outcome).toBe('completed')
      if (result.outcome === 'completed') {
        expect(result.result).toBeUndefined()
      }
      expect(result.totalCostUsd).toBeUndefined()
    })

    it('detects quota exceeded and parses reset time', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        result: "You've hit your limit · resets 6pm (UTC)",
      }
      const result = toSessionEnd(sdkMessage)
      expect(result.outcome).toBe('quota_exceeded')
      if (result.outcome === 'quota_exceeded') {
        expect(result.message).toBe("You've hit your limit · resets 6pm (UTC)")
        expect(result.resetTime).toBeInstanceOf(Date)
      }
    })

    it('handles empty errors array as empty messages', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'error_during_execution',
        errors: [],
      }
      const result = toSessionEnd(sdkMessage)
      expect(result.outcome).toBe('execution_error')
      if (result.outcome === 'execution_error') {
        expect(result.messages).toEqual([])
      }
    })
  })

  describe('toStreamEvents', () => {
    it('yields SessionEndCompleted for success result message', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        result: 'Done',
      }
      const events = [...toStreamEvents(sdkMessage)]
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'stream_end',
        outcome: 'completed',
        result: 'Done',
        totalCostUsd: undefined,
      })
    })

    it('yields multiple events for text message with content blocks', () => {
      const sdkMessage = {
        type: 'text',
        message: {
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'tool_use', name: 'bash', input: { cmd: 'ls' } },
          ],
        },
      }
      const events = [...toStreamEvents(sdkMessage)]
      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({ type: 'stream_text', text: 'Hello' })
      expect(events[1]).toEqual({
        type: 'stream_tool_invocation',
        name: 'bash',
        input: { cmd: 'ls' },
      })
    })

    it('filters out unknown block types', () => {
      const sdkMessage = {
        type: 'text',
        message: {
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'unknown', data: 'ignored' },
            { type: 'tool_use', name: 'bash', input: {} },
          ],
        },
      }
      const events = [...toStreamEvents(sdkMessage)]
      expect(events).toHaveLength(2)
    })

    it('yields nothing for message without content', () => {
      const sdkMessage = { type: 'text' }
      const events = [...toStreamEvents(sdkMessage)]
      expect(events).toHaveLength(0)
    })

    it('yields nothing for message with empty content', () => {
      const sdkMessage = {
        type: 'text',
        message: { content: [] },
      }
      const events = [...toStreamEvents(sdkMessage)]
      expect(events).toHaveLength(0)
    })

    it('yields thinking event for message with thinking block', () => {
      const sdkMessage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Let me think about this...' },
            { type: 'text', text: 'Based on my analysis...' },
          ],
        },
      }
      const events = [...toStreamEvents(sdkMessage)]
      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({
        type: 'stream_thinking',
        thinking: 'Let me think about this...',
      })
      expect(events[1]).toEqual({
        type: 'stream_text',
        text: 'Based on my analysis...',
      })
    })
  })

  describe('toSdkHookCallbackMatchers', () => {
    it('SC-AC010: returns empty array for empty input', () => {
      const result = toSdkHookCallbackMatchers([])
      expect(result).toEqual([])
    })

    it('SC-AC011: converts single hook preserving matcher', () => {
      const hook: PreToolUseHook = {
        name: 'test-hook',
        matcher: 'Bash|Edit',
        callback: vi.fn().mockResolvedValue({ continue: true }),
      }

      const result = toSdkHookCallbackMatchers([hook])

      expect(result).toHaveLength(1)
      expect(result[0]!.matcher).toBe('Bash|Edit')
      expect(result[0]!.hooks).toHaveLength(1)
    })

    it('SC-AC012: converts multiple hooks preserving order', () => {
      const hooks: PreToolUseHook[] = [
        {
          name: 'hook1',
          matcher: 'Bash',
          callback: vi.fn().mockResolvedValue({ continue: true }),
        },
        {
          name: 'hook2',
          matcher: 'Edit',
          callback: vi.fn().mockResolvedValue({ continue: true }),
        },
      ]

      const result = toSdkHookCallbackMatchers(hooks)

      expect(result).toHaveLength(2)
      expect(result[0]!.matcher).toBe('Bash')
      expect(result[1]!.matcher).toBe('Edit')
    })

    describe('wrapped callback behavior', () => {
      const baseHookInput = {
        session_id: 'test-session',
        transcript_path: '/tmp/transcript',
        cwd: '/tmp/project',
        tool_use_id: 'tool-use-123',
      }

      it('SC-AC013: transforms HookInput to PreToolUseInput', async () => {
        const mockCallback = vi.fn().mockResolvedValue({
          continue: true,
          decision: 'approve',
        })

        const hook: PreToolUseHook = {
          name: 'test-hook',
          callback: mockCallback,
        }

        const [matcher] = toSdkHookCallbackMatchers([hook])
        const wrappedCallback = matcher!.hooks[0]!

        const sdkInput = {
          ...baseHookInput,
          hook_event_name: 'PreToolUse' as const,
          tool_name: 'Bash',
          tool_input: { command: 'ls -la' },
        }

        await wrappedCallback(sdkInput, 'tool-123', {
          signal: new AbortController().signal,
        })

        expect(mockCallback).toHaveBeenCalledWith({
          toolName: 'Bash',
          toolInput: { command: 'ls -la' },
        })
      })

      it('SC-AC014: defaults tool_name to empty string when missing', async () => {
        const mockCallback = vi.fn().mockResolvedValue({ continue: true })
        const hook: PreToolUseHook = { name: 'test', callback: mockCallback }

        const [matcher] = toSdkHookCallbackMatchers([hook])
        const wrappedCallback = matcher!.hooks[0]!

        // Test defensive handling when SDK passes incomplete input
        await wrappedCallback(
          {
            ...baseHookInput,
            hook_event_name: 'PreToolUse' as const,
          } as HookInput,
          undefined,
          { signal: new AbortController().signal },
        )

        expect(mockCallback).toHaveBeenCalledWith({
          toolName: '',
          toolInput: {},
        })
      })

      it('SC-AC015: defaults tool_input to empty object when missing', async () => {
        const mockCallback = vi.fn().mockResolvedValue({ continue: true })
        const hook: PreToolUseHook = { name: 'test', callback: mockCallback }

        const [matcher] = toSdkHookCallbackMatchers([hook])
        const wrappedCallback = matcher!.hooks[0]!

        // Test defensive handling when SDK passes incomplete input
        await wrappedCallback(
          {
            ...baseHookInput,
            hook_event_name: 'PreToolUse' as const,
            tool_name: 'Bash',
          } as HookInput,
          'tool-id',
          { signal: new AbortController().signal },
        )

        expect(mockCallback).toHaveBeenCalledWith({
          toolName: 'Bash',
          toolInput: {},
        })
      })

      it('SC-AC016: transforms HookResult to SyncHookJSONOutput', async () => {
        const mockCallback = vi.fn().mockResolvedValue({
          continue: true,
          decision: 'approve',
          reason: 'Allowed command',
        })

        const hook: PreToolUseHook = { name: 'test', callback: mockCallback }
        const [matcher] = toSdkHookCallbackMatchers([hook])

        const result = await matcher!.hooks[0]!(
          {
            ...baseHookInput,
            hook_event_name: 'PreToolUse' as const,
            tool_name: 'Bash',
            tool_input: {},
          },
          'tool-id',
          { signal: new AbortController().signal },
        )

        expect(result).toEqual({
          continue: true,
          decision: 'approve',
          reason: 'Allowed command',
        })
      })

      it('SC-AC017: correctly propagates block decision with reason', async () => {
        const mockCallback = vi.fn().mockResolvedValue({
          continue: false,
          decision: 'block',
          reason: 'Security violation',
        })

        const hook: PreToolUseHook = { name: 'test', callback: mockCallback }
        const [matcher] = toSdkHookCallbackMatchers([hook])

        const result = await matcher!.hooks[0]!(
          {
            ...baseHookInput,
            hook_event_name: 'PreToolUse' as const,
            tool_name: 'Bash',
            tool_input: {},
          },
          'tool-id',
          { signal: new AbortController().signal },
        )

        expect(result).toEqual({
          continue: false,
          decision: 'block',
          reason: 'Security violation',
        })
      })
    })
  })
})
