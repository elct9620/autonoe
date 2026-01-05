import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'
import type {
  Query as SDKQuery,
  Options as SDKOptions,
  PermissionMode as SDKPermissionMode,
  SandboxSettings as SDKSandboxSettings,
  HookCallbackMatcher,
  HookCallback,
  HookInput,
  SyncHookJSONOutput,
  McpSdkServerConfigWithInstance,
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentClient,
  MessageStream,
  AgentClientOptions,
  PreToolUseHook,
  PreToolUseInput,
  HookResult,
} from '@autonoe/core'
import { detectClaudeCodePath } from './claudeCodePath'
import { toSdkMcpServers, toStreamEvents } from './converters'

/**
 * Extended options for ClaudeAgentClient
 * Includes SDK-specific MCP server support
 */
export interface ClaudeAgentClientOptions extends AgentClientOptions {
  /**
   * SDK MCP servers created with createSdkMcpServer
   * These run in-process and are merged with external mcpServers
   */
  sdkMcpServers?: McpSdkServerConfigWithInstance[]
}

/**
 * Convert domain PreToolUseHook to SDK HookCallbackMatcher format
 */
function toSdkHookCallbackMatchers(
  hooks: PreToolUseHook[],
): HookCallbackMatcher[] {
  return hooks.map((hook) => ({
    matcher: hook.matcher,
    hooks: [wrapHookCallback(hook.callback)],
  }))
}

/**
 * Wrap domain hook callback to SDK HookCallback format
 */
function wrapHookCallback(
  callback: (input: PreToolUseInput) => Promise<HookResult>,
): HookCallback {
  return async (
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

    const result = await callback(preToolInput)

    return {
      continue: result.continue,
      decision: result.decision,
      reason: result.reason,
    }
  }
}

/**
 * Real implementation of AgentClient that wraps the Claude Agent SDK
 */
export class ClaudeAgentClient implements AgentClient {
  private abortController: AbortController | null = null

  constructor(private options: ClaudeAgentClientOptions) {}

  query(message: string): MessageStream {
    this.abortController = new AbortController()
    const abortController = this.abortController
    const options = this.options

    const sdkOptions: SDKOptions = {
      cwd: options.cwd,
      abortController,
      pathToClaudeCodeExecutable: detectClaudeCodePath(),
      model: options.model,
    }

    // Merge external MCP servers and SDK MCP servers
    const externalMcpServers = options.mcpServers
      ? toSdkMcpServers(options.mcpServers)
      : {}

    const sdkMcpServers = options.sdkMcpServers
      ? Object.fromEntries(
          options.sdkMcpServers.map((server) => [server.name, server]),
        )
      : {}

    const mergedMcpServers = { ...externalMcpServers, ...sdkMcpServers }

    if (Object.keys(mergedMcpServers).length > 0) {
      sdkOptions.mcpServers = mergedMcpServers
    }

    if (options.permissionLevel) {
      sdkOptions.permissionMode = options.permissionLevel as SDKPermissionMode
    }

    if (options.allowedTools) {
      sdkOptions.allowedTools = options.allowedTools
    }

    // Add sandbox settings (hardcoded, always enabled)
    if (options.sandbox) {
      const sandboxSettings: SDKSandboxSettings = {
        enabled: options.sandbox.enabled,
        autoAllowBashIfSandboxed: options.sandbox.autoAllowBashIfSandboxed,
      }
      sdkOptions.sandbox = sandboxSettings
    }

    // Add PreToolUse hooks
    if (options.preToolUseHooks && options.preToolUseHooks.length > 0) {
      sdkOptions.hooks = {
        PreToolUse: toSdkHookCallbackMatchers(options.preToolUseHooks),
      }
    }

    // Add thinking tokens for extended thinking mode
    if (options.maxThinkingTokens) {
      sdkOptions.maxThinkingTokens = options.maxThinkingTokens
    }

    const sdkQueryResult: SDKQuery = sdkQuery({
      prompt: message,
      options: sdkOptions,
    })

    // Wrap SDK query to convert messages to domain types
    return this.wrapSdkQuery(sdkQueryResult)
  }

  /**
   * Wrap SDK Query to convert SDK messages to domain StreamEvents
   * Flattens batched SDK messages into individual events
   * Wraps SDK errors as StreamError events instead of throwing
   */
  private wrapSdkQuery(sdkQuery: SDKQuery): MessageStream {
    const generator = (async function* () {
      try {
        for await (const sdkMessage of sdkQuery) {
          // Flatten SDK message into multiple StreamEvents
          for (const event of toStreamEvents(sdkMessage)) {
            yield event
          }
        }
      } catch (error) {
        // Yield error as StreamError event instead of throwing
        // This handles cases like quota exceeded where SDK throws after session_end
        yield {
          type: 'stream_error' as const,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      }
    })()

    const stream = generator as MessageStream
    stream.interrupt = () => sdkQuery.interrupt()

    return stream
  }
}
