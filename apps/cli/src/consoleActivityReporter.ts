import type { ActivityReporter, ActivityEvent } from '@autonoe/core'
import { formatDuration } from '@autonoe/core'

/**
 * Options for ConsoleActivityReporter
 */
export interface ConsoleActivityReporterOptions {
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
  elapsedMs: number
  waitingRemainingMs?: number
  waitingResetTime?: Date
}

/**
 * Console-based activity reporter for session execution
 * Displays activity status in a single line with periodic updates
 * @see SPEC.md Section 3.5 Activity Feedback
 */
export class ConsoleActivityReporter implements ActivityReporter {
  private static readonly RESET = '\x1b[0m'
  private static readonly CYAN = '\x1b[36m'

  private readonly updateIntervalMs: number
  private state: ActivityState = {
    currentActivity: 'idle',
    toolCount: 0,
    elapsedMs: 0,
  }
  private intervalId?: ReturnType<typeof setInterval>

  constructor(options: ConsoleActivityReporterOptions = {}) {
    this.updateIntervalMs = options.updateIntervalMs ?? 1000
  }

  startSession(): () => void {
    // Reset state for new session
    this.state = {
      currentActivity: 'idle',
      toolCount: 0,
      elapsedMs: 0,
    }

    // Start periodic display update
    this.intervalId = setInterval(() => {
      this.render()
    }, this.updateIntervalMs)

    // Return cleanup function
    return () => {
      if (this.intervalId) {
        clearInterval(this.intervalId)
        this.intervalId = undefined
      }
      // Clear the activity line
      process.stdout.write('\r\x1b[K')
    }
  }

  reportActivity(event: ActivityEvent): void {
    this.state.elapsedMs = event.elapsedMs

    switch (event.type) {
      case 'thinking':
        this.state.currentActivity = 'thinking'
        break

      case 'tool_start':
        this.state.currentActivity = 'tool'
        this.state.currentTool = event.toolName
        break

      case 'tool_complete':
        this.state.toolCount++
        // Keep showing tool activity until next event
        break

      case 'responding':
        this.state.currentActivity = 'responding'
        break

      case 'waiting':
        this.state.currentActivity = 'waiting'
        this.state.waitingRemainingMs = event.remainingMs
        this.state.waitingResetTime = event.resetTime
        break
    }

    // Immediate render on state change
    this.render()
  }

  private render(): void {
    if (this.state.currentActivity === 'idle') {
      return
    }

    const line = this.formatActivityLine()
    process.stdout.write(
      `\r${ConsoleActivityReporter.CYAN}${line}${ConsoleActivityReporter.RESET}`,
    )
  }

  private formatActivityLine(): string {
    if (this.state.currentActivity === 'waiting') {
      return this.formatWaitingLine()
    }

    const elapsed = this.formatElapsedTime(this.state.elapsedMs)
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

  private formatElapsedTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
      default:
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
