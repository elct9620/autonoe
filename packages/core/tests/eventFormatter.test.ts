import { describe, it, expect } from 'vitest'
import { formatStreamEvent } from '../src/eventFormatter'
import type {
  AgentText,
  AgentThinking,
  ToolInvocation,
  ToolResponse,
  SessionEndCompleted,
  SessionEndExecutionError,
  SessionEndMaxIterations,
  SessionEndBudgetExceeded,
  SessionEndQuotaExceeded,
  StreamError,
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

  describe('AgentThinking', () => {
    it('formats thinking content with prefix', () => {
      const event: AgentThinking = {
        type: 'agent_thinking',
        thinking: 'Let me analyze this step by step...',
      }
      expect(formatStreamEvent(event)).toBe(
        '[thinking] Let me analyze this step by step...',
      )
    })

    it('truncates long thinking content to 200 chars', () => {
      const longThinking = 'a'.repeat(250)
      const event: AgentThinking = {
        type: 'agent_thinking',
        thinking: longThinking,
      }
      const result = formatStreamEvent(event)
      expect(result).toContain('[thinking]')
      expect(result.length).toBeLessThan(250)
      expect(result).toContain('...')
    })

    it('handles empty thinking', () => {
      const event: AgentThinking = { type: 'agent_thinking', thinking: '' }
      expect(formatStreamEvent(event)).toBe('[thinking] ')
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
    it('formats completed with result text', () => {
      const event: SessionEndCompleted = {
        type: 'session_end',
        outcome: 'completed',
        result: 'Task completed',
      }
      expect(formatStreamEvent(event)).toBe(
        '[session: completed] Task completed',
      )
    })

    it('formats error with error messages', () => {
      const event: SessionEndExecutionError = {
        type: 'session_end',
        outcome: 'execution_error',
        messages: ['Error 1', 'Error 2'],
      }
      expect(formatStreamEvent(event)).toBe(
        '[session: execution_error] Error 1, Error 2',
      )
    })

    it('formats without result or errors', () => {
      const event: SessionEndMaxIterations = {
        type: 'session_end',
        outcome: 'max_iterations',
      }
      expect(formatStreamEvent(event)).toBe('[session: max_iterations]')
    })

    it('formats budget exceeded', () => {
      const event: SessionEndBudgetExceeded = {
        type: 'session_end',
        outcome: 'budget_exceeded',
      }
      expect(formatStreamEvent(event)).toBe('[session: budget_exceeded]')
    })

    it('formats quota exceeded', () => {
      const event: SessionEndQuotaExceeded = {
        type: 'session_end',
        outcome: 'quota_exceeded',
        message: "You've hit your limit",
      }
      expect(formatStreamEvent(event)).toBe(
        "[session: quota_exceeded] You've hit your limit",
      )
    })
  })

  describe('StreamError', () => {
    it('formats error message', () => {
      const event: StreamError = {
        type: 'stream_error',
        message: 'Connection lost',
      }
      expect(formatStreamEvent(event)).toBe('[error] Connection lost')
    })

    it('formats error message with stack', () => {
      const event: StreamError = {
        type: 'stream_error',
        message: 'Connection lost',
        stack: 'at Function.run ()',
      }
      expect(formatStreamEvent(event)).toBe('[error] Connection lost')
    })
  })

  describe('unknown event type', () => {
    it('returns [unknown] for unrecognized type', () => {
      const event = { type: 'unknown_type' } as any
      expect(formatStreamEvent(event)).toBe('[unknown]')
    })
  })
})
