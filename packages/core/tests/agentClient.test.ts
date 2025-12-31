import { describe, it, expect, beforeEach } from 'vitest'
import { MockAgentClient, createMockAgentText } from './helpers'

describe('MockAgentClient', () => {
  let client: MockAgentClient

  beforeEach(() => {
    client = new MockAgentClient()
  })

  it('yields pre-set responses in order', async () => {
    const events = [createMockAgentText('Hello'), createMockAgentText('World')]
    client.setResponses(events)

    const results: unknown[] = []
    for await (const msg of client.query('test')) {
      results.push(msg)
    }

    expect(results).toEqual(events)
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
    const firstEvents = [createMockAgentText('First')]
    const secondEvents = [createMockAgentText('Second')]

    client.setResponses(firstEvents)
    let results: unknown[] = []
    for await (const msg of client.query('first query')) {
      results.push(msg)
    }
    expect(results).toEqual(firstEvents)

    client.setResponses(secondEvents)
    results = []
    for await (const msg of client.query('second query')) {
      results.push(msg)
    }
    expect(results).toEqual(secondEvents)
  })
})
