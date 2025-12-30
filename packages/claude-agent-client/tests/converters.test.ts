import { describe, it, expect } from 'vitest'
import {
  toSdkMcpServers,
  toResultSubtype,
  toStreamEvent,
  toSessionEnd,
  toStreamEvents,
} from '../src/converters'
import { ResultSubtype } from '@autonoe/core'

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

  describe('toResultSubtype', () => {
    it('SC-AC006: converts "success" to ResultSubtype.Success', () => {
      expect(toResultSubtype('success')).toBe(ResultSubtype.Success)
    })

    it('SC-AC007: converts "error_max_turns"', () => {
      expect(toResultSubtype('error_max_turns')).toBe(
        ResultSubtype.ErrorMaxTurns,
      )
    })

    it('SC-AC008: converts "error_during_execution"', () => {
      expect(toResultSubtype('error_during_execution')).toBe(
        ResultSubtype.ErrorDuringExecution,
      )
    })

    it('SC-AC009: converts "error_max_budget_usd"', () => {
      expect(toResultSubtype('error_max_budget_usd')).toBe(
        ResultSubtype.ErrorMaxBudgetUsd,
      )
    })

    it('SC-AC010: defaults unknown subtypes to ErrorDuringExecution', () => {
      expect(toResultSubtype('unknown')).toBe(
        ResultSubtype.ErrorDuringExecution,
      )
      expect(toResultSubtype('')).toBe(ResultSubtype.ErrorDuringExecution)
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
        content: [{ type: 'text', text: 'part1' }, { type: 'text', text: 'part2' }],
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
  })

  describe('toSessionEnd', () => {
    it('converts SDK result message to SessionEnd', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        result: 'Done',
        total_cost_usd: 0.05,
      }
      const result = toSessionEnd(sdkMessage)
      expect(result).toEqual({
        type: 'session_end',
        subtype: ResultSubtype.Success,
        result: 'Done',
        errors: undefined,
        totalCostUsd: 0.05,
      })
    })

    it('converts error result message', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'error_during_execution',
        errors: ['Error 1', 'Error 2'],
      }
      const result = toSessionEnd(sdkMessage)
      expect(result).toEqual({
        type: 'session_end',
        subtype: ResultSubtype.ErrorDuringExecution,
        result: undefined,
        errors: ['Error 1', 'Error 2'],
        totalCostUsd: undefined,
      })
    })

    it('handles missing optional fields', () => {
      const sdkMessage = { type: 'result', subtype: 'success' }
      const result = toSessionEnd(sdkMessage)
      expect(result.result).toBeUndefined()
      expect(result.errors).toBeUndefined()
      expect(result.totalCostUsd).toBeUndefined()
    })
  })

  describe('toStreamEvents', () => {
    it('yields SessionEnd for result message', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        result: 'Done',
      }
      const events = [...toStreamEvents(sdkMessage)]
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'session_end',
        subtype: ResultSubtype.Success,
        result: 'Done',
        errors: undefined,
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
  })
})
