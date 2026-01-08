import { describe, it, expect } from 'vitest'
import { Session } from '../src/session'
import {
  MockAgentClient,
  createMockStreamText,
  createMockStreamEnd,
  createMockErrorStreamEnd,
  createMockQuotaExceededStreamEnd,
  createMockStreamError,
  TestLogger,
} from './helpers'

describe('Session', () => {
  describe('run()', () => {
    it('returns a SessionResult', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamText('2')])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test instruction')

      expect(result).toHaveProperty('costUsd')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('outcome')
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

      expect(result.outcome).toBe('completed')
    })

    it('returns costUsd from session end event', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('Result', 0.0567)])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test')

      expect(result.costUsd).toBe(0.0567)
    })

    it('returns zero costUsd when no cost in result', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('Result')])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test')

      expect(result.costUsd).toBe(0)
    })

    it('tracks execution duration', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamText('done')])

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test')

      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('SC-L004: Debug logging', () => {
    it('logs debug messages with injected logger', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamText('done')])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test', logger)

      expect(logger.hasMessage('[Send]')).toBe(true)
      expect(logger.hasMessage('[Recv]')).toBe(true)

      const debugEntries = logger.getEntriesByLevel('debug')
      expect(debugEntries.length).toBeGreaterThan(0)
    })
  })

  describe('SC-S006: Session end event (success)', () => {
    it('displays result text via logger.info', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('The answer is 2', 0.0123)])
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
      client.setResponses([createMockStreamEnd(undefined as any)])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test', logger)

      // Should not crash, no result text logged
      const infoEntries = logger.getEntriesByLevel('info')
      expect(infoEntries.length).toBe(0)
    })
  })

  describe('SC-S007: Session end event (error)', () => {
    it('displays error messages via logger.error', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockErrorStreamEnd(['Error 1', 'Error 2'])])
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

  describe('StreamError handling', () => {
    it('ignores stream error after session_end (expected for quota exceeded)', async () => {
      const client = new MockAgentClient()
      client.setResponses([
        createMockQuotaExceededStreamEnd("You've hit your limit"),
        createMockStreamError('Claude Code process exited with code 1'),
      ])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })
      const result = await session.run(client, 'test', logger)

      // Should complete normally with quota exceeded outcome
      expect(result.outcome).toBe('quota_exceeded')

      // Stream error should be logged at debug level
      const debugEntries = logger.getEntriesByLevel('debug')
      expect(
        debugEntries.some((e) => e.message.includes('Stream error after')),
      ).toBe(true)
    })

    it('throws when stream error occurs without session_end', async () => {
      const client = new MockAgentClient()
      client.setResponses([
        createMockStreamText('Processing...'),
        createMockStreamError('Connection lost'),
      ])

      const session = new Session({ projectDir: '/test/project' })

      await expect(session.run(client, 'test')).rejects.toThrow(
        'Connection lost',
      )
    })

    it('logs stream error at error level when no session_end', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamError('Unexpected failure')])
      const logger = new TestLogger()

      const session = new Session({ projectDir: '/test/project' })

      try {
        await session.run(client, 'test', logger)
      } catch {
        // Expected to throw
      }

      const errorEntries = logger.getEntriesByLevel('error')
      expect(errorEntries.some((e) => e.message === 'Stream error')).toBe(true)
    })
  })

  describe('dispose lifecycle', () => {
    it('calls dispose after successful session', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamEnd('done', 0.01)])

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test')

      expect(client.getDisposeCount()).toBe(1)
    })

    it('calls dispose even when stream error occurs', async () => {
      const client = new MockAgentClient()
      client.setResponses([createMockStreamError('test error')])

      const session = new Session({ projectDir: '/test/project' })

      await expect(session.run(client, 'test')).rejects.toThrow()
      expect(client.getDisposeCount()).toBe(1)
    })

    it('calls dispose only once per session', async () => {
      const client = new MockAgentClient()
      client.setResponses([
        createMockStreamText('processing'),
        createMockStreamEnd('done', 0.01),
      ])

      const session = new Session({ projectDir: '/test/project' })
      await session.run(client, 'test')

      expect(client.getDisposeCount()).toBe(1)
    })
  })
})
