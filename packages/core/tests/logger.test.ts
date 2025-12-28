import { describe, it, expect } from 'vitest'
import { silentLogger } from '../src/logger'
import { TestLogger } from './helpers'

describe('Logger', () => {
  describe('silentLogger', () => {
    it('SC-L003: discards all output without side effects', () => {
      // silentLogger should not throw
      expect(() => {
        silentLogger.info('test info message')
        silentLogger.debug('test debug message')
      }).not.toThrow()
    })
  })

  describe('TestLogger', () => {
    it('SC-L001: captures info messages with level', () => {
      const logger = new TestLogger()

      logger.info('test info message')

      const entries = logger.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0]).toEqual({
        level: 'info',
        message: 'test info message',
      })
    })

    it('SC-L002: captures debug messages with level', () => {
      const logger = new TestLogger()

      logger.debug('test debug message')

      const entries = logger.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0]).toEqual({
        level: 'debug',
        message: 'test debug message',
      })
    })

    it('captures multiple messages in order', () => {
      const logger = new TestLogger()

      logger.info('first')
      logger.debug('second')
      logger.info('third')

      const messages = logger.getMessages()
      expect(messages).toEqual(['first', 'second', 'third'])
    })

    it('filters entries by level', () => {
      const logger = new TestLogger()

      logger.info('info 1')
      logger.debug('debug 1')
      logger.info('info 2')

      const infoEntries = logger.getEntriesByLevel('info')
      expect(infoEntries).toHaveLength(2)
      expect(infoEntries.map((e) => e.message)).toEqual(['info 1', 'info 2'])
    })

    it('checks if message exists', () => {
      const logger = new TestLogger()

      logger.info('hello world')

      expect(logger.hasMessage('hello')).toBe(true)
      expect(logger.hasMessage('world')).toBe(true)
      expect(logger.hasMessage('foo')).toBe(false)
    })

    it('clears all entries', () => {
      const logger = new TestLogger()

      logger.info('message')
      expect(logger.getEntries()).toHaveLength(1)

      logger.clear()
      expect(logger.getEntries()).toHaveLength(0)
    })
  })
})
