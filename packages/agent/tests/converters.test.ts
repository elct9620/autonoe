import { describe, it, expect } from 'vitest'
import {
  toSdkMcpServers,
  toSessionOutcome,
  toStreamEvent,
  toSessionEnd,
  toStreamEvents,
} from '../src/converters'
import { SessionOutcome } from '@autonoe/core'

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

  describe('toSessionOutcome', () => {
    it('SC-AC006: converts "success" to SessionOutcome.Completed', () => {
      expect(toSessionOutcome('success')).toBe(SessionOutcome.Completed)
    })

    it('SC-AC007: converts "error_max_turns" to MaxIterationsReached', () => {
      expect(toSessionOutcome('error_max_turns')).toBe(
        SessionOutcome.MaxIterationsReached,
      )
    })

    it('SC-AC008: converts "error_during_execution" to ExecutionError', () => {
      expect(toSessionOutcome('error_during_execution')).toBe(
        SessionOutcome.ExecutionError,
      )
    })

    it('SC-AC009: converts "error_max_budget_usd" to BudgetExceeded', () => {
      expect(toSessionOutcome('error_max_budget_usd')).toBe(
        SessionOutcome.BudgetExceeded,
      )
    })

    it('SC-AC010: defaults unknown subtypes to ExecutionError', () => {
      expect(toSessionOutcome('unknown')).toBe(SessionOutcome.ExecutionError)
      expect(toSessionOutcome('')).toBe(SessionOutcome.ExecutionError)
    })

    it('detects quota exceeded from result text', () => {
      expect(
        toSessionOutcome('success', "You've hit your limit · resets 6pm (UTC)"),
      ).toBe(SessionOutcome.QuotaExceeded)
    })

    it('converts error_max_structured_output_retries to ExecutionError', () => {
      expect(toSessionOutcome('error_max_structured_output_retries')).toBe(
        SessionOutcome.ExecutionError,
      )
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
        outcome: SessionOutcome.Completed,
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
        outcome: SessionOutcome.ExecutionError,
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

    it('detects quota exceeded and parses reset time', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        result: "You've hit your limit · resets 6pm (UTC)",
      }
      const result = toSessionEnd(sdkMessage)
      expect(result.outcome).toBe(SessionOutcome.QuotaExceeded)
      expect(result.quotaResetTime).toBeInstanceOf(Date)
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
        outcome: SessionOutcome.Completed,
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
