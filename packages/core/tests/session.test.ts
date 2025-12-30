import { describe, it, expect } from 'vitest'
import { Session } from '../src/session'
import {
  MockAgentClient,
  createMockTextMessage,
  createMockResultMessage,
  createMockErrorResultMessage,
  TestLogger,
} from './helpers'

describe('Session', () => {
  describe('run()', () => {
    it('returns a SessionResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('2')])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test instruction')

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('costUsd')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('deliverablesPassedCount')
      expect(result).toHaveProperty('deliverablesTotalCount')
    })

    it('queries the agent with the provided instruction', async () => {
      const client = new MockAgentClient()
      client.setResponses([])

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'custom instruction')

      expect(client.getLastMessage()).toBe('custom instruction')
    })

    it('accepts session options', async () => {
      const client = new MockAgentClient()
      client.setResponses([])

      const session = new Session({
        projectDir: '/test/project',
        model: 'claude-3',
      })
      const result = await session.run(client, 'test')

      expect(result.success).toBe(true)
    })

    it('returns costUsd from result message', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('Result', 0.0567)])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test')

      expect(result.costUsd).toBe(0.0567)
    })

    it('returns zero costUsd when no cost in result', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('Result')])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test')

      expect(result.costUsd).toBe(0)
    })

    it('tracks execution duration', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test')

      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('SC-L004: Debug logging', () => {
    it('logs debug messages with injected logger', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockTextMessage('done')])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test', logger)

      expect(logger.hasMessage('Sending instruction')).toBe(true)
      expect(logger.hasMessage('Received:')).toBe(true)

      const debugEntries = logger.getEntriesByLevel('debug')
      expect(debugEntries.length).toBeGreaterThan(0)
    })
  })

  describe('SC-S006: Result event (success)', () => {
    it('displays result text via logger.info', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage('The answer is 2', 0.0123)])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test', logger)

      expect(logger.hasMessage('The answer is 2')).toBe(true)
      const infoEntries = logger.getEntriesByLevel('info')
      expect(infoEntries.some((e) => e.message === 'The answer is 2')).toBe(
        true,
      )
    })

    it('handles result without text gracefully', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockResultMessage(undefined as any)])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test', logger)

      // Should not crash, no result text logged
      const infoEntries = logger.getEntriesByLevel('info')
      expect(infoEntries.length).toBe(0)
    })
  })

  describe('SC-S007: Result event (error)', () => {
    it('displays error messages via logger.error', async () => {
      const client = new MockAgentClient()
      client.setResponses([
        createMockErrorResultMessage(['Error 1', 'Error 2']),
      ])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test', logger)

      expect(logger.hasMessage('Error 1')).toBe(true)
      expect(logger.hasMessage('Error 2')).toBe(true)

      const errorEntries = logger.getEntriesByLevel('error')
      expect(errorEntries.some((e) => e.message === 'Error 1')).toBe(true)
      expect(errorEntries.some((e) => e.message === 'Error 2')).toBe(true)
    })
  })
})
