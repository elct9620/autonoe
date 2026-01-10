import type {
  McpServerConfig as SDKMcpServerConfig,
  HookCallbackMatcher,
  HookInput,
  SyncHookJSONOutput,
} from '@anthropic-ai/claude-agent-sdk'
import type {
  StreamEvent,
  StreamEventEnd,
  McpServer,
  PreToolUseHook,
  PreToolUseInput,
} from '@autonoe/core'
import { isQuotaExceededMessage, parseQuotaResetTime } from '@autonoe/core'

/**
 * SDK content block type definition
 */
interface SDKContentBlock {
  type: string
  text?: string
  thinking?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string | Array<{ type: string; text?: string }>
  is_error?: boolean
}

/**
 * SDK message type definition
 */
interface SDKMessage {
  type: string
  subtype?: string
  result?: string
  errors?: string[]
  total_cost_usd?: number
  message?: {
    content?: SDKContentBlock[]
  }
}

/**
 * Convert domain McpServer to SDK McpServerConfig
 */
export function toSdkMcpServers(
  mcpServers: Record<string, McpServer>,
): Record<string, SDKMcpServerConfig> {
  const result: Record<string, SDKMcpServerConfig> = {}
  for (const [name, server] of Object.entries(mcpServers)) {
    result[name] = {
      command: server.command,
      args: server.args,
    }
  }
  return result
}

/**
 * Convert a single SDK content block to a StreamEvent
 * Returns null for unknown block types
 */
export function toStreamEvent(block: SDKContentBlock): StreamEvent | null {
  switch (block.type) {
    case 'thinking':
      return {
        type: 'stream_thinking',
        thinking: block.thinking ?? '',
      }

    case 'text':
      return {
        type: 'stream_text',
        text: block.text ?? '',
      }

    case 'tool_use':
      return {
        type: 'stream_tool_invocation',
        name: block.name ?? '',
        input: block.input ?? {},
      }

    case 'tool_result': {
      // Normalize content: array of text blocks to single string
      let content = ''
      if (typeof block.content === 'string') {
        content = block.content
      } else if (Array.isArray(block.content)) {
        content = block.content.map((c) => c.text ?? '').join('')
      }
      return {
        type: 'stream_tool_response',
        toolUseId: block.tool_use_id ?? '',
        content,
        isError: block.is_error ?? false,
      }
    }

    default:
      return null
  }
}

/**
 * Convert SDK result message to StreamEventEnd
 * Returns appropriate variant based on SDK subtype and result text
 */
export function toSessionEnd(sdkMessage: SDKMessage): StreamEventEnd {
  const subtype = sdkMessage.subtype ?? ''
  const costUsd = sdkMessage.total_cost_usd

  // Check for quota exceeded first (SDK reports as 'success' with limit message)
  if (sdkMessage.result && isQuotaExceededMessage(sdkMessage.result)) {
    return {
      type: 'stream_end',
      outcome: 'quota_exceeded',
      message: sdkMessage.result,
      resetTime: parseQuotaResetTime(sdkMessage.result),
      totalCostUsd: costUsd,
    }
  }

  switch (subtype) {
    case 'success':
      return {
        type: 'stream_end',
        outcome: 'completed',
        result: sdkMessage.result,
        totalCostUsd: costUsd,
      }
    case 'error_max_turns':
      return {
        type: 'stream_end',
        outcome: 'max_iterations',
        totalCostUsd: costUsd,
      }
    case 'error_max_budget_usd':
      return {
        type: 'stream_end',
        outcome: 'budget_exceeded',
        totalCostUsd: costUsd,
      }
    case 'error_during_execution':
    case 'error_max_structured_output_retries':
    default:
      return {
        type: 'stream_end',
        outcome: 'execution_error',
        messages: sdkMessage.errors ?? [],
        totalCostUsd: costUsd,
      }
  }
}

/**
 * Flatten a single SDK message into multiple StreamEvents
 * SDK messages may contain multiple content blocks; returns each as a separate event
 */
export function toStreamEvents(sdkMessage: SDKMessage): StreamEvent[] {
  if (sdkMessage.type === 'result') {
    return [toSessionEnd(sdkMessage)]
  }

  if (!sdkMessage.message?.content) {
    return []
  }

  return sdkMessage.message.content
    .map((block) => toStreamEvent(block))
    .filter((event): event is StreamEvent => event !== null)
}

/**
 * Convert domain PreToolUseHook array to SDK HookCallbackMatcher format
 * Wraps each hook callback to transform domain types to SDK types
 */
export function toSdkHookCallbackMatchers(
  hooks: PreToolUseHook[],
): HookCallbackMatcher[] {
  return hooks.map((hook) => ({
    matcher: hook.matcher,
    hooks: [
      async (
        input: HookInput,
        _toolUseId: string | undefined,
        _options: { signal: AbortSignal },
      ): Promise<SyncHookJSONOutput> => {
        // Extract PreToolUse-specific fields from HookInput
        const hookInput = input as {
          hook_event_name: string
          tool_name?: string
          tool_input?: Record<string, unknown>
        }

        const preToolInput: PreToolUseInput = {
          toolName: hookInput.tool_name ?? '',
          toolInput: hookInput.tool_input ?? {},
        }

        const result = await hook.callback(preToolInput)

        return {
          continue: result.continue,
          decision: result.decision,
          reason: result.reason,
        }
      },
    ],
  }))
}
