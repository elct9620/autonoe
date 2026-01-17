import { describe, it, expect } from 'vitest'
import { formatStreamEvent } from '../src/eventFormatter'
import type {
  StreamEventText,
  StreamEventThinking,
  StreamEventToolInvocation,
  StreamEventToolResponse,
  StreamEventEnd,
  StreamEventError,
} from '../src/types'

describe('formatStreamEvent', () => {
  describe('StreamEventText', () => {
    it('returns the text content', () => {
      const event: StreamEventText = {
        type: 'stream_text',
        text: 'Hello world',
      }
      expect(formatStreamEvent(event)).toBe('Hello world')
    })

    it('handles empty text', () => {
      const event: StreamEventText = { type: 'stream_text', text: '' }
      expect(formatStreamEvent(event)).toBe('')
    })
  })

  describe('StreamEventThinking', () => {
    it('formats thinking content with prefix', () => {
      const event: StreamEventThinking = {
        type: 'stream_thinking',
        thinking: 'Let me analyze this step by step...',
      }
      expect(formatStreamEvent(event)).toBe(
        '[thinking] Let me analyze this step by step...',
      )
    })

    it('truncates long thinking content to 200 chars', () => {
      const longThinking = 'a'.repeat(250)
      const event: StreamEventThinking = {
        type: 'stream_thinking',
        thinking: longThinking,
      }
      const result = formatStreamEvent(event)
      expect(result).toContain('[thinking]')
      expect(result.length).toBeLessThan(250)
      expect(result).toContain('...')
    })

    it('handles empty thinking', () => {
      const event: StreamEventThinking = {
        type: 'stream_thinking',
        thinking: '',
      }
      expect(formatStreamEvent(event)).toBe('[thinking] ')
    })
  })

  describe('StreamEventToolInvocation', () => {
    it('formats tool name and input', () => {
      const event: StreamEventToolInvocation = {
        type: 'stream_tool_invocation',
        toolUseId: 'test-id',
        name: 'bash',
        input: { command: 'ls' },
      }
      expect(formatStreamEvent(event)).toBe('[tool: bash] {"command":"ls"}')
    })

    it('truncates long input to 100 chars', () => {
      const longInput = 'a'.repeat(150)
      const event: StreamEventToolInvocation = {
        type: 'stream_tool_invocation',
        toolUseId: 'test-id',
        name: 'bash',
        input: { command: longInput },
      }
      const result = formatStreamEvent(event)
      expect(result).toContain('[tool: bash]')
      expect(result.length).toBeLessThan(150)
      expect(result).toContain('...')
    })

    it('handles empty input', () => {
      const event: StreamEventToolInvocation = {
        type: 'stream_tool_invocation',
        toolUseId: 'test-id',
        name: 'bash',
        input: {},
      }
      expect(formatStreamEvent(event)).toBe('[tool: bash] {}')
    })
  })

  describe('StreamEventToolResponse', () => {
    it('formats success result', () => {
      const event: StreamEventToolResponse = {
        type: 'stream_tool_response',
        toolUseId: 'id-123',
        content: 'file1.txt\nfile2.txt',
        isError: false,
      }
      expect(formatStreamEvent(event)).toBe('[result] file1.txt\nfile2.txt')
    })

    it('formats error result with ERROR suffix', () => {
      const event: StreamEventToolResponse = {
        type: 'stream_tool_response',
        toolUseId: 'id-123',
        content: 'command not found',
        isError: true,
      }
      expect(formatStreamEvent(event)).toBe('[result ERROR] command not found')
    })

    it('truncates long content to 100 chars', () => {
      const longContent = 'x'.repeat(150)
      const event: StreamEventToolResponse = {
        type: 'stream_tool_response',
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

  describe('StreamEventEnd', () => {
    it('formats completed with result text', () => {
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'completed',
        result: 'Task completed',
      }
      expect(formatStreamEvent(event)).toBe(
        '[session: completed] Task completed',
      )
    })

    it('formats error with error messages', () => {
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'execution_error',
        messages: ['Error 1', 'Error 2'],
      }
      expect(formatStreamEvent(event)).toBe(
        '[session: execution_error] Error 1, Error 2',
      )
    })

    it('formats without result or errors', () => {
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'max_iterations',
      }
      expect(formatStreamEvent(event)).toBe('[session: max_iterations]')
    })

    it('formats budget exceeded', () => {
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'budget_exceeded',
      }
      expect(formatStreamEvent(event)).toBe('[session: budget_exceeded]')
    })

    it('formats quota exceeded', () => {
      const event: StreamEventEnd = {
        type: 'stream_end',
        outcome: 'quota_exceeded',
        message: "You've hit your limit",
      }
      expect(formatStreamEvent(event)).toBe(
        "[session: quota_exceeded] You've hit your limit",
      )
    })
  })

  describe('StreamEventError', () => {
    it('formats error message', () => {
      const event: StreamEventError = {
        type: 'stream_error',
        message: 'Connection lost',
      }
      expect(formatStreamEvent(event)).toBe('[error] Connection lost')
    })

    it('formats error message with stack', () => {
      const event: StreamEventError = {
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
