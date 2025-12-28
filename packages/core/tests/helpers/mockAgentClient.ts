import type { AgentClient } from '../../src/agentClient'
import type { AgentMessage, MessageStream } from '../../src/types'

/**
 * Mock implementation of AgentClient for unit testing
 * @see SPEC.md Section 3.2
 */
export class MockAgentClient implements AgentClient {
  private responses: AgentMessage[] = []
  private lastMessage: string | null = null

  /**
   * Set the responses that will be yielded by query()
   */
  setResponses(responses: AgentMessage[]): void {
    this.responses = [...responses]
  }

  /**
   * Get the last message sent to query()
   */
  getLastMessage(): string | null {
    return this.lastMessage
  }

  query(message: string): MessageStream {
    this.lastMessage = message
    const responses = this.responses

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
