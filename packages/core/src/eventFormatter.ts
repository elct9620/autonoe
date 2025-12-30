/**
 * Event formatter for debug logging
 * @see SPEC.md Section 3.7.1 Debug Message Format
 */

import type { StreamEvent } from './types'

const TRUNCATE_INPUT = 100
const TRUNCATE_CONTENT = 100

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

    case 'tool_invocation': {
      const input = JSON.stringify(event.input)
      return `[tool: ${event.name}] ${truncate(input, TRUNCATE_INPUT)}`
    }

    case 'tool_response': {
      const error = event.isError ? ' ERROR' : ''
      return `[result${error}] ${truncate(event.content, TRUNCATE_CONTENT)}`
    }

    case 'session_end': {
      if (event.result) {
        return `[session: ${event.subtype}] ${event.result}`
      }
      if (event.errors?.length) {
        return `[session: ${event.subtype}] ${event.errors.join(', ')}`
      }
      return `[session: ${event.subtype}]`
    }

    default:
      return '[unknown]'
  }
}
