/**
 * Event formatter for debug logging
 * @see SPEC.md Section 3.8.1 Debug Message Format
 */

import type { StreamEvent } from './types'

const TRUNCATE_INPUT = 100
const TRUNCATE_CONTENT = 100
const TRUNCATE_THINKING = 200

/**
 * Truncate string to specified length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str
}

/**
 * Format a StreamEvent for debug logging
 */
export function formatStreamEvent(event: StreamEvent): string {
  switch (event.type) {
    case 'agent_text':
      return event.text

    case 'agent_thinking':
      return `[thinking] ${truncate(event.thinking, TRUNCATE_THINKING)}`

    case 'tool_invocation': {
      const input = JSON.stringify(event.input)
      return `[tool: ${event.name}] ${truncate(input, TRUNCATE_INPUT)}`
    }

    case 'tool_response': {
      const error = event.isError ? ' ERROR' : ''
      return `[result${error}] ${truncate(event.content, TRUNCATE_CONTENT)}`
    }

    case 'session_end': {
      if (event.outcome === 'completed' && event.result) {
        return `[session: completed] ${event.result}`
      }
      if (event.outcome === 'execution_error' && event.messages.length) {
        return `[session: execution_error] ${event.messages.join(', ')}`
      }
      if (event.outcome === 'quota_exceeded' && event.message) {
        return `[session: quota_exceeded] ${event.message}`
      }
      return `[session: ${event.outcome}]`
    }

    case 'stream_error':
      return `[error] ${event.message}`

    default:
      return '[unknown]'
  }
}
