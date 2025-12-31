import { describe, it, expect } from 'vitest'
import { formatStreamEvent } from '../src/eventFormatter'
import { ResultSubtype } from '../src/types'
import type {
  AgentText,
  ToolInvocation,
  ToolResponse,
  SessionEnd,
} from '../src/types'

describe('formatStreamEvent', () => {
  describe('AgentText', () => {
    it('returns the text content', () => {
      const event: AgentText = { type: 'agent_text', text: 'Hello world' }
      expect(formatStreamEvent(event)).toBe('Hello world')
    })

    it('handles empty text', () => {
      const event: AgentText = { type: 'agent_text', text: '' }
      expect(formatStreamEvent(event)).toBe('')
    })
  })

  describe('ToolInvocation', () => {
    it('formats tool name and input', () => {
      const event: ToolInvocation = {
        type: 'tool_invocation',
        name: 'bash',
        input: { command: 'ls' },
      }
      expect(formatStreamEvent(event)).toBe('[tool: bash] {"command":"ls"}')
    })

    it('truncates long input to 100 chars', () => {
      const longInput = 'a'.repeat(150)
      const event: ToolInvocation = {
        type: 'tool_invocation',
        name: 'bash',
        input: { command: longInput },
      }
      const result = formatStreamEvent(event)
      expect(result).toContain('[tool: bash]')
      expect(result.length).toBeLessThan(150)
      expect(result).toContain('...')
    })

    it('handles empty input', () => {
      const event: ToolInvocation = {
        type: 'tool_invocation',
        name: 'bash',
        input: {},
      }
      expect(formatStreamEvent(event)).toBe('[tool: bash] {}')
    })
  })

  describe('ToolResponse', () => {
    it('formats success result', () => {
      const event: ToolResponse = {
        type: 'tool_response',
        toolUseId: 'id-123',
        content: 'file1.txt\nfile2.txt',
        isError: false,
      }
      expect(formatStreamEvent(event)).toBe('[result] file1.txt\nfile2.txt')
    })

    it('formats error result with ERROR suffix', () => {
      const event: ToolResponse = {
        type: 'tool_response',
        toolUseId: 'id-123',
        content: 'command not found',
        isError: true,
      }
      expect(formatStreamEvent(event)).toBe('[result ERROR] command not found')
    })

    it('truncates long content to 100 chars', () => {
      const longContent = 'x'.repeat(150)
      const event: ToolResponse = {
        type: 'tool_response',
        toolUseId: 'id-123',
        content: longContent,
        isError: false,
      }
      const result = formatStreamEvent(event)
      expect(result).toContain('[result]')
      expect(result.length).toBeLessThan(150)
      expect(result).toContain('...')
    })
  })

  describe('SessionEnd', () => {
    it('formats success with result text', () => {
      const event: SessionEnd = {
        type: 'session_end',
        subtype: ResultSubtype.Success,
        result: 'Task completed',
      }
      expect(formatStreamEvent(event)).toBe('[session: success] Task completed')
    })

    it('formats error with error messages', () => {
      const event: SessionEnd = {
        type: 'session_end',
        subtype: ResultSubtype.ErrorDuringExecution,
        errors: ['Error 1', 'Error 2'],
      }
      expect(formatStreamEvent(event)).toBe(
        '[session: error_during_execution] Error 1, Error 2',
      )
    })

    it('formats without result or errors', () => {
      const event: SessionEnd = {
        type: 'session_end',
        subtype: ResultSubtype.ErrorMaxTurns,
      }
      expect(formatStreamEvent(event)).toBe('[session: error_max_turns]')
    })

    it('formats max budget error', () => {
      const event: SessionEnd = {
        type: 'session_end',
        subtype: ResultSubtype.ErrorMaxBudgetUsd,
      }
      expect(formatStreamEvent(event)).toBe('[session: error_max_budget_usd]')
    })
  })

  describe('unknown event type', () => {
    it('returns [unknown] for unrecognized type', () => {
      const event = { type: 'unknown_type' } as any
      expect(formatStreamEvent(event)).toBe('[unknown]')
    })
  })
})
