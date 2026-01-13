import type { AgentClient, AgentClientFactory } from '../../src/agentClient'
import type { StreamEvent, MessageStream } from '../../src/types'

/**
 * Mock implementation of AgentClient for unit testing
 * @see SPEC.md Section 3.2
 */
export class MockAgentClient implements AgentClient {
  private responseSets: StreamEvent[][] = []
  private callIndex = 0
  private lastMessage: string | undefined
  private disposeCount = 0

  /**
   * Set the responses that will be yielded by query()
   * For single-session tests
   */
  setResponses(responses: StreamEvent[]): void {
    this.responseSets = [responses]
    this.callIndex = 0
  }

  /**
   * Set responses for multiple sessions
   * Each call to query() will return the next set of responses
   */
  setResponsesPerSession(responseSets: StreamEvent[][]): void {
    this.responseSets = responseSets
    this.callIndex = 0
  }

  /**
   * Get the last message sent to query()
   */
  getLastMessage(): string | undefined {
    return this.lastMessage
  }

  /**
   * Get the number of times query() has been called
   */
  getQueryCount(): number {
    return this.callIndex
  }

  /**
   * Reset the call index for reuse in tests
   */
  reset(): void {
    this.callIndex = 0
  }

  /**
   * Get the number of times dispose() has been called
   */
  getDisposeCount(): number {
    return this.disposeCount
  }

  /**
   * Dispose the client (mock implementation)
   */
  async dispose(): Promise<void> {
    this.disposeCount++
  }

  query(message: string): MessageStream {
    this.lastMessage = message
    const responses =
      this.responseSets[
        Math.min(this.callIndex, this.responseSets.length - 1)
      ] ?? []
    this.callIndex++

    const generator = (async function* () {
      for (const response of responses) {
        yield response
      }
    })()

    // Add interrupt method to the generator
    const stream = generator as MessageStream
    stream.interrupt = async () => {
      // Mock interrupt - does nothing in tests
    }

    return stream
  }
}

/**
 * Create a factory that returns the same MockAgentClient instance
 * Useful for tests that need to track calls across multiple sessions
 *
 * Factory.create() now accepts instructionName parameter but the mock
 * ignores it since tests don't need real MCP server creation.
 */
export function createMockClientFactory(
  client: MockAgentClient,
): AgentClientFactory {
  return {
    create: () => client,
  }
}
