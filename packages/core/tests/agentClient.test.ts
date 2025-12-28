import { describe, it, expect, beforeEach } from 'vitest'
import { MockAgentClient } from './mockAgentClient'
import { createMockTextMessage } from './fixtures'

describe('MockAgentClient', () => {
  let client: MockAgentClient

  beforeEach(() => {
    client = new MockAgentClient()
  })

  it('yields pre-set responses in order', async () => {
    const messages = [
      createMockTextMessage('Hello'),
      createMockTextMessage('World'),
    ]
    client.setResponses(messages)

    const results: unknown[] = []
    for await (const msg of client.query('test')) {
      results.push(msg)
    }

    expect(results).toEqual(messages)
  })

  it('supports empty response list', async () => {
    client.setResponses([])

    const results: unknown[] = []
    for await (const msg of client.query('test')) {
      results.push(msg)
    }

    expect(results).toEqual([])
  })

  it('interrupt() resolves without error', async () => {
    const query = client.query('test')
    await expect(query.interrupt()).resolves.toBeUndefined()
  })

  it('records the last message sent', async () => {
    client.query('Hello, Claude')
    expect(client.getLastMessage()).toBe('Hello, Claude')
  })

  it('can be reset with new responses', async () => {
    const firstMessages = [createMockTextMessage('First')]
    const secondMessages = [createMockTextMessage('Second')]

    client.setResponses(firstMessages)
    let results: unknown[] = []
    for await (const msg of client.query('first query')) {
      results.push(msg)
    }
    expect(results).toEqual(firstMessages)

    client.setResponses(secondMessages)
    results = []
    for await (const msg of client.query('second query')) {
      results.push(msg)
    }
    expect(results).toEqual(secondMessages)
  })
})
