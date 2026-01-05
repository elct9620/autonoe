import { describe, it, expect } from 'vitest'
import {
  toSdkMcpServers,
  toStreamEvent,
  toSessionEnd,
  toStreamEvents,
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
        type: 'agent_text',
        text: 'Hello',
      })
    })

    it('handles empty text', () => {
      const block = { type: 'text' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'agent_text',
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
        type: 'tool_invocation',
        name: 'bash',
        input: { command: 'ls' },
      })
    })

    it('handles tool_use with missing fields', () => {
      const block = { type: 'tool_use' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'tool_invocation',
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
        type: 'tool_response',
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
        type: 'tool_response',
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
        type: 'tool_response',
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
        type: 'agent_thinking',
        thinking: 'Let me analyze this...',
      })
    })

    it('handles thinking block with empty content', () => {
      const block = { type: 'thinking' }
      const result = toStreamEvent(block)
      expect(result).toEqual({
        type: 'agent_thinking',
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
        type: 'session_end',
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
        type: 'session_end',
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
        type: 'session_end',
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
        type: 'session_end',
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
        type: 'session_end',
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
      expect(events[0]).toEqual({ type: 'agent_text', text: 'Hello' })
      expect(events[1]).toEqual({
        type: 'tool_invocation',
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
        type: 'agent_thinking',
        thinking: 'Let me think about this...',
      })
      expect(events[1]).toEqual({
        type: 'agent_text',
        text: 'Based on my analysis...',
      })
    })
  })
})
