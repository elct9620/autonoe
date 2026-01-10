import type { Logger } from '@autonoe/core'

/**
 * Options for ConsoleLogger
 */
export interface ConsoleLoggerOptions {
  /**
   * Show debug messages (default: false)
   */
  debug?: boolean
}

/**
 * Console-based logger with colored output
 * Used in CLI for user-visible output
 */
export class ConsoleLogger implements Logger {
  private static readonly RESET = '\x1b[0m'
  private static readonly CYAN = '\x1b[36m'
  private static readonly GRAY = '\x1b[90m'
  private static readonly YELLOW = '\x1b[33m'
  private static readonly RED = '\x1b[31m'

  private readonly showDebug: boolean

  constructor(options: ConsoleLoggerOptions = {}) {
    this.showDebug = options.debug ?? false
  }

  private formatMessage(color: string, message: string): string {
    return `${color}${message}${ConsoleLogger.RESET}`
  }

  info(message: string): void {
    console.log(this.formatMessage(ConsoleLogger.CYAN, message))
  }

  debug(message: string): void {
    if (this.showDebug) {
      console.log(this.formatMessage(ConsoleLogger.GRAY, `[debug] ${message}`))
    }
  }

  warn(message: string): void {
    console.error(this.formatMessage(ConsoleLogger.YELLOW, message))
  }

  error(message: string, error?: Error): void {
    console.error(this.formatMessage(ConsoleLogger.RED, message))
    if (this.showDebug && error?.stack) {
      console.error(this.formatMessage(ConsoleLogger.GRAY, error.stack))
    }
  }
}
