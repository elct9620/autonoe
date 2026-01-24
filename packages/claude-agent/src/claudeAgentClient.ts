import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'
import type {
  Query as SDKQuery,
  Options as SDKOptions,
  SandboxSettings as SDKSandboxSettings,
  McpSdkServerConfigWithInstance,
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AgentClient,
  MessageStream,
  AgentClientOptions,
} from '@autonoe/core'
import { detectClaudeCodePath } from './claudeCodePath'
import {
  toSdkMcpServers,
  toStreamEvents,
  toSdkHookCallbackMatchers,
} from './converters'

/**
 * Extended options for ClaudeAgentClient
 * Includes SDK-specific options not part of core AgentClientOptions
 */
export interface ClaudeAgentClientOptions extends AgentClientOptions {
  /**
   * SDK MCP servers created with createSdkMcpServer
   * These run in-process and are merged with external mcpServers
   */
  sdkMcpServers?: McpSdkServerConfigWithInstance[]
}

/**
 * Real implementation of AgentClient that wraps the Claude Agent SDK
 */
export class ClaudeAgentClient implements AgentClient {
  private abortController: AbortController | undefined

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
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
      },
      settingSources: ['project'],
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

    // Autonoe requires acceptEdits to operate autonomously
    sdkOptions.permissionMode = 'acceptEdits'

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
   * Dispose the client and release resources
   * Currently a placeholder until SDK v2 supports resource cleanup
   */
  async dispose(): Promise<void> {
    // TODO: Implement resource cleanup when SDK v2 is available
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
