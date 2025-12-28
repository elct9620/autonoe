import type { AgentClient, Query } from '../src/agentClient'

/**
 * Mock message type for testing
 * Simplified version of SDKMessage for unit tests
 */
export interface MockMessage {
  type: string
  [key: string]: unknown
}

/**
 * Mock implementation of AgentClient for unit testing
 * @see SPEC.md Section 3.2
 */
export class MockAgentClient implements AgentClient {
  private responses: MockMessage[] = []
  private lastMessage: string | null = null

  /**
   * Set the responses that will be yielded by query()
   */
  setResponses(responses: MockMessage[]): void {
    this.responses = [...responses]
  }

  /**
   * Get the last message sent to query()
   */
  getLastMessage(): string | null {
    return this.lastMessage
  }

  query(message: string): Query {
    this.lastMessage = message
    const responses = this.responses

    const generator = (async function* () {
      for (const response of responses) {
        yield response
      }
    })()

    // Add interrupt method to the generator
    const query = generator as Query
    query.interrupt = async () => {
      // Mock interrupt - does nothing in tests
    }

    return query
  }
}
