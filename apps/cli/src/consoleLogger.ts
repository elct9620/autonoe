import type { Logger } from '@autonoe/core'

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
}

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
  private showDebug: boolean

  constructor(options: ConsoleLoggerOptions = {}) {
    this.showDebug = options.debug ?? false
  }

  info(message: string): void {
    console.log(`${colors.cyan}${message}${colors.reset}`)
  }

  debug(message: string): void {
    if (this.showDebug) {
      console.log(`${colors.gray}[debug] ${message}${colors.reset}`)
    }
  }

  warn(message: string): void {
    console.log(`${colors.yellow}${message}${colors.reset}`)
  }

  error(message: string): void {
    console.log(`${colors.red}${message}${colors.reset}`)
  }
}
