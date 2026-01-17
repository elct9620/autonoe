import type { ActivityReporter, ActivityEvent } from '../../src/index'

/**
 * Mock ActivityReporter for testing
 * Captures all activity events for assertions
 */
export class MockActivityReporter implements ActivityReporter {
  private events: ActivityEvent[] = []
  private sessionStartCount = 0
  private cleanupCallCount = 0

  startSession(): () => void {
    this.sessionStartCount++
    return () => {
      this.cleanupCallCount++
    }
  }

  reportActivity(event: ActivityEvent): void {
    this.events.push(event)
  }

  /**
   * Get all captured events
   */
  getEvents(): ActivityEvent[] {
    return [...this.events]
  }

  /**
   * Get events of a specific type
   */
  getEventsByType<T extends ActivityEvent['type']>(
    type: T,
  ): Extract<ActivityEvent, { type: T }>[] {
    return this.events.filter((e) => e.type === type) as Extract<
      ActivityEvent,
      { type: T }
    >[]
  }

  /**
   * Get the number of times startSession was called
   */
  getSessionStartCount(): number {
    return this.sessionStartCount
  }

  /**
   * Get the number of times cleanup was called
   */
  getCleanupCallCount(): number {
    return this.cleanupCallCount
  }

  /**
   * Reset the mock state
   */
  reset(): void {
    this.events = []
    this.sessionStartCount = 0
    this.cleanupCallCount = 0
  }
}
