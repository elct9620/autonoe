import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk'
import type {
  Query as SDKQuery,
  Options as SDKOptions,
  PermissionMode as SDKPermissionMode,
} from '@anthropic-ai/claude-agent-sdk'
import type { AgentClient, MessageStream, AgentClientOptions } from '@autonoe/core'
import { detectClaudeCodePath } from './claudeCodePath'
import { toSdkMcpServers, toAgentMessage } from './converters'

/**
 * Real implementation of AgentClient that wraps the Claude Agent SDK
 */
export class ClaudeAgentClient implements AgentClient {
  private abortController: AbortController | null = null

  constructor(private options: AgentClientOptions) {}

  query(message: string): MessageStream {
    this.abortController = new AbortController()
    const abortController = this.abortController
    const options = this.options

    const sdkOptions: SDKOptions = {
      cwd: options.cwd,
      abortController,
      pathToClaudeCodeExecutable: detectClaudeCodePath(),
    }

    if (options.mcpServers) {
      sdkOptions.mcpServers = toSdkMcpServers(options.mcpServers)
    }

    if (options.permissionLevel) {
      sdkOptions.permissionMode = options.permissionLevel as SDKPermissionMode
    }

    if (options.allowedTools) {
      sdkOptions.allowedTools = options.allowedTools
    }

    const sdkQueryResult: SDKQuery = sdkQuery({
      prompt: message,
      options: sdkOptions,
    })

    // Wrap SDK query to convert messages to domain types
    return this.wrapSdkQuery(sdkQueryResult)
  }

  /**
   * Wrap SDK Query to convert SDK messages to domain AgentMessages
   */
  private wrapSdkQuery(sdkQuery: SDKQuery): MessageStream {
    const generator = (async function* () {
      for await (const sdkMessage of sdkQuery) {
        yield toAgentMessage(sdkMessage)
      }
    })()

    const stream = generator as MessageStream
    stream.interrupt = () => sdkQuery.interrupt()

    return stream
  }
}
