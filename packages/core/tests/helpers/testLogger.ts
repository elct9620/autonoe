import type { Logger, LogLevel } from '../../src/logger'

/**
 * A log entry captured by TestLogger
 */
export interface LogEntry {
  level: LogLevel
  message: string
}

/**
 * Test logger that captures all messages for verification
 * Use this in tests instead of letting console.log output freely
 */
export class TestLogger implements Logger {
  private entries: LogEntry[] = []

  info(message: string): void {
    this.entries.push({ level: 'info', message })
  }

  debug(message: string): void {
    this.entries.push({ level: 'debug', message })
  }

  /**
   * Get all captured log entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries]
  }

  /**
   * Get entries filtered by level
   */
  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((e) => e.level === level)
  }

  /**
   * Get all messages (for simple assertions)
   */
  getMessages(): string[] {
    return this.entries.map((e) => e.message)
  }

  /**
   * Check if a message was logged at any level
   */
  hasMessage(message: string): boolean {
    return this.entries.some((e) => e.message.includes(message))
  }

  /**
   * Clear all captured entries
   */
  clear(): void {
    this.entries = []
  }
}
