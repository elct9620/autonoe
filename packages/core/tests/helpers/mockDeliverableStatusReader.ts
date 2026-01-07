import {
  DeliverableStatus,
  type DeliverableStatusReader,
} from '../../src/index'

/**
 * Mock implementation of DeliverableStatusReader for testing
 * Supports returning a sequence of statuses to simulate progress across sessions
 */
export class MockDeliverableStatusReader implements DeliverableStatusReader {
  private statusSequence: DeliverableStatus[] = []
  private callIndex = 0

  /**
   * Set the sequence of statuses to return on successive load() calls
   */
  setStatusSequence(statuses: DeliverableStatus[]): void {
    this.statusSequence = statuses
    this.callIndex = 0
  }

  async exists(): Promise<boolean> {
    return this.statusSequence.length > 0
  }

  async load(): Promise<DeliverableStatus> {
    if (this.statusSequence.length === 0) {
      return DeliverableStatus.empty()
    }
    const status =
      this.statusSequence[
        Math.min(this.callIndex, this.statusSequence.length - 1)
      ]
    this.callIndex++
    return status ?? DeliverableStatus.empty()
  }

  /**
   * Reset the call index for reuse in tests
   */
  reset(): void {
    this.callIndex = 0
  }

  /**
   * Get the number of times load() has been called
   */
  getCallCount(): number {
    return this.callIndex
  }
}
