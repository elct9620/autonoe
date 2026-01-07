/**
 * Deliverable domain types
 * @see SPEC.md Section 2.3 Domain Model, Section 3.5
 */

/**
 * Deliverable entity - a verifiable work unit with acceptance criteria
 */
export interface Deliverable {
  id: string
  description: string
  acceptanceCriteria: string[]
  passed: boolean
  blocked: boolean // When true, deliverable is blocked due to external constraints
}

/**
 * DeliverableStatus aggregate root - persisted in .autonoe/status.json
 * Immutable class with query methods for deliverable state
 */
export class DeliverableStatus {
  readonly createdAt: string
  readonly updatedAt: string
  readonly deliverables: readonly Deliverable[]

  constructor(
    createdAt: string,
    updatedAt: string,
    deliverables: Deliverable[],
  ) {
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.deliverables = deliverables
  }

  /**
   * Factory method to create an empty status with current date
   */
  static empty(): DeliverableStatus {
    const now = new Date().toISOString().split('T')[0]!
    return new DeliverableStatus(now, now, [])
  }

  /**
   * Factory method to create a status from data
   */
  static create(
    createdAt: string,
    updatedAt: string,
    deliverables: Deliverable[],
  ): DeliverableStatus {
    return new DeliverableStatus(createdAt, updatedAt, deliverables)
  }

  /**
   * Count passed deliverables
   */
  countPassed(): number {
    return this.deliverables.filter((d) => d.passed).length
  }

  /**
   * Count blocked deliverables
   */
  countBlocked(): number {
    return this.deliverables.filter((d) => d.blocked).length
  }

  /**
   * Check if all achievable (non-blocked) deliverables have passed
   */
  allAchievablePassed(): boolean {
    const achievable = this.deliverables.filter((d) => !d.blocked)
    if (achievable.length === 0) {
      return false
    }
    return achievable.every((d) => d.passed)
  }

  /**
   * Check if all deliverables are blocked
   */
  allBlocked(): boolean {
    if (this.deliverables.length === 0) {
      return false
    }
    return this.deliverables.every((d) => d.blocked)
  }

  /**
   * Create a new status with updated deliverables
   */
  withDeliverables(deliverables: Deliverable[]): DeliverableStatus {
    return new DeliverableStatus(this.createdAt, this.updatedAt, deliverables)
  }

  /**
   * Create a new status with updated timestamp
   */
  withUpdatedAt(updatedAt: string): DeliverableStatus {
    return new DeliverableStatus(this.createdAt, updatedAt, [
      ...this.deliverables,
    ])
  }
}

/**
 * Single deliverable input for batch creation
 */
export interface DeliverableInput {
  id: string
  description: string
  acceptanceCriteria: string[]
}

/**
 * Input for create_deliverable tool (batch creation)
 */
export interface CreateDeliverableInput {
  deliverables: DeliverableInput[]
}

/**
 * Deliverable status values
 * - pending: reset state (passed=false, blocked=false)
 * - passed: completed (passed=true, blocked=false)
 * - blocked: external constraints (passed=false, blocked=true)
 */
export type DeliverableStatusValue = 'pending' | 'passed' | 'blocked'

/**
 * Notification payload for deliverable status changes
 */
export interface DeliverableStatusNotification {
  deliverableId: string
  deliverableDescription: string
  previousStatus: DeliverableStatusValue | null
  newStatus: DeliverableStatusValue
}

/**
 * Callback type for status change notifications
 */
export type DeliverableStatusCallback = (
  notification: DeliverableStatusNotification,
) => void

/**
 * Input for set_deliverable_status tool
 */
export interface SetDeliverableStatusInput {
  deliverableId: string
  status: DeliverableStatusValue
}

/**
 * Tool result returned to the agent
 */
export interface ToolResult {
  success: boolean
  message: string
  error?: string
}

/**
 * Read-only interface for checking deliverable status
 * Used by SessionRunner to determine loop termination
 */
export interface DeliverableStatusReader {
  exists(): Promise<boolean>
  load(): Promise<DeliverableStatus>
}

/**
 * Full repository interface for deliverable persistence
 * Implementation lives in infrastructure layer (agent)
 */
export interface DeliverableRepository extends DeliverableStatusReader {
  save(status: DeliverableStatus): Promise<void>
}

/**
 * Null object implementation of DeliverableStatusReader
 * Always returns exists() = false, load() returns empty status
 */
export const nullDeliverableStatusReader: DeliverableStatusReader = {
  async exists(): Promise<boolean> {
    return false
  },
  async load(): Promise<DeliverableStatus> {
    return DeliverableStatus.empty()
  },
}
