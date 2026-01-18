import type { StreamEvent } from '@autonoe/core'
import { formatDuration } from '@autonoe/core'
import type { Presenter } from './presenter'

/**
 * Options for ConsolePresenter
 */
export interface ConsolePresenterOptions {
  /**
   * Show debug messages (default: false)
   */
  debug?: boolean

  /**
   * Update interval in milliseconds (default: 1000 = 1 second)
   */
  updateIntervalMs?: number
}

/**
 * Internal state for activity display
 */
interface ActivityState {
  currentActivity: 'idle' | 'thinking' | 'tool' | 'responding' | 'waiting'
  currentTool?: string
  toolCount: number
  startTime: number
  waitingRemainingMs?: number
  waitingResetTime?: Date
}

/**
 * Console-based presenter that unifies logging and activity display
 * Coordinates output to prevent log lines from overwriting activity line
 * @see SPEC.md Section 3.5 Activity Feedback
 */
export class ConsolePresenter implements Presenter {
  private static readonly RESET = '\x1b[0m'
  private static readonly CYAN = '\x1b[36m'
  private static readonly GRAY = '\x1b[90m'
  private static readonly YELLOW = '\x1b[33m'
  private static readonly RED = '\x1b[31m'

  private readonly showDebug: boolean
  private readonly updateIntervalMs: number
  private state: ActivityState = {
    currentActivity: 'idle',
    toolCount: 0,
    startTime: Date.now(),
  }
  private timeoutId?: ReturnType<typeof setTimeout>
  private hasActivityLine = false
  private isRunning = false

  constructor(options: ConsolePresenterOptions = {}) {
    this.showDebug = options.debug ?? false
    this.updateIntervalMs = options.updateIntervalMs ?? 1000
  }

  // =============================================
  // Presenter lifecycle methods
  // =============================================

  start(): void {
    // Reset state for new session
    this.state = {
      currentActivity: 'idle',
      toolCount: 0,
      startTime: Date.now(),
    }
    this.hasActivityLine = false
    this.isRunning = true

    // Start periodic display update using recursive setTimeout
    this.scheduleNextRender()
  }

  stop(): void {
    this.isRunning = false
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }
    this.clearActivity()
  }

  private scheduleNextRender(): void {
    this.timeoutId = setTimeout(() => {
      if (this.isRunning) {
        this.render()
        this.scheduleNextRender()
      }
    }, this.updateIntervalMs)
  }

  // =============================================
  // Logger methods - coordinate with activity line
  // =============================================

  private formatMessage(color: string, message: string): string {
    return `${color}${message}${ConsolePresenter.RESET}`
  }

  private preserveActivityLine(action: () => void): void {
    if (this.hasActivityLine) {
      // Clear the activity line before logging
      process.stdout.write('\r\x1b[K')
    }
    action()
    if (this.hasActivityLine && this.state.currentActivity !== 'idle') {
      // Restore the activity line after logging
      this.render()
    }
  }

  info(message: string): void {
    this.preserveActivityLine(() => {
      console.log(this.formatMessage(ConsolePresenter.CYAN, message))
    })
  }

  debug(message: string): void {
    if (this.showDebug) {
      this.preserveActivityLine(() => {
        console.log(
          this.formatMessage(ConsolePresenter.GRAY, `[debug] ${message}`),
        )
      })
    }
  }

  warn(message: string): void {
    this.preserveActivityLine(() => {
      console.error(this.formatMessage(ConsolePresenter.YELLOW, message))
    })
  }

  error(message: string, error?: Error): void {
    this.preserveActivityLine(() => {
      console.error(this.formatMessage(ConsolePresenter.RED, message))
      if (this.showDebug && error?.stack) {
        console.error(this.formatMessage(ConsolePresenter.GRAY, error.stack))
      }
    })
  }

  // =============================================
  // Activity methods - handle StreamEvents
  // =============================================

  activity(event: StreamEvent): void {
    this.updateState(event)
    this.render()
  }

  clearActivity(): void {
    if (this.hasActivityLine) {
      process.stdout.write('\r\x1b[K')
      this.hasActivityLine = false
    }
  }

  private updateState(event: StreamEvent): void {
    switch (event.type) {
      case 'stream_thinking':
        this.state.currentActivity = 'thinking'
        break

      case 'stream_tool_invocation':
        this.state.currentActivity = 'tool'
        this.state.currentTool = event.name
        break

      case 'stream_tool_response':
        this.state.toolCount++
        // Keep showing tool activity until next event
        break

      case 'stream_text':
        this.state.currentActivity = 'responding'
        break

      case 'stream_waiting':
        this.state.currentActivity = 'waiting'
        this.state.waitingRemainingMs = event.remainingMs
        this.state.waitingResetTime = event.resetTime
        break

      case 'stream_end':
        // Clear activity on session end
        this.state.currentActivity = 'idle'
        this.clearActivity()
        break

      case 'stream_error':
        // No change - error handling is done by Session lifecycle
        // @see SPEC.md Section 3.5
        break
    }
  }

  private render(): void {
    if (this.state.currentActivity === 'idle') {
      return
    }

    const line = this.formatActivityLine()
    process.stdout.write(
      `\r\x1b[K${ConsolePresenter.CYAN}${line}${ConsolePresenter.RESET}`,
    )
    this.hasActivityLine = true
  }

  private formatActivityLine(): string {
    if (this.state.currentActivity === 'waiting') {
      return this.formatWaitingLine()
    }

    const elapsed = this.formatElapsedTime()
    const activity = this.getActivityText()
    const toolSuffix = this.getToolCountSuffix()

    return `\u26A1 ${elapsed} ${activity}${toolSuffix}`
  }

  private formatWaitingLine(): string {
    const remaining = this.state.waitingRemainingMs ?? 0
    const resetTime = this.state.waitingResetTime

    let message = `\u23F3 Waiting... ${formatDuration(remaining)} remaining`
    if (resetTime) {
      message += ` (resets at ${this.formatResetTime(resetTime)})`
    }
    return message
  }

  private formatElapsedTime(): string {
    const elapsedMs = Date.now() - this.state.startTime
    return formatDuration(elapsedMs)
  }

  private formatResetTime(date: Date): string {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  private getActivityText(): string {
    switch (this.state.currentActivity) {
      case 'thinking':
        return 'Thinking...'
      case 'tool':
        return `Running ${this.state.currentTool}...`
      case 'responding':
        return 'Responding...'
      case 'idle':
      case 'waiting':
        // These cases are handled before this method is called:
        // - idle: render() returns early
        // - waiting: formatActivityLine() calls formatWaitingLine()
        return ''
    }
  }

  private getToolCountSuffix(): string {
    if (this.state.toolCount === 0) {
      return ''
    }
    const plural = this.state.toolCount === 1 ? 'tool' : 'tools'
    return ` (${this.state.toolCount} ${plural})`
  }
}
