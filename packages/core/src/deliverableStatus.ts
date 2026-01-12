/**
 * Deliverable domain types
 * @see SPEC.md Section 2.3 Domain Model, Section 3.5
 */

import { Deliverable, type DeliverableStatusValue } from './deliverable'

/**
 * DeliverableStatus aggregate root - persisted in .autonoe/status.json
 * Immutable class with query methods for deliverable state
 */
export class DeliverableStatus {
  readonly createdAt: string
  readonly updatedAt: string
  readonly deliverables: readonly Deliverable[]

  private constructor(
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
   * Get active (non-deprecated) deliverables for termination evaluation
   */
  get activeDeliverables(): readonly Deliverable[] {
    return this.deliverables.filter((d) => !d.deprecated)
  }

  /**
   * Count passed deliverables (excludes deprecated)
   */
  countPassed(): number {
    return this.activeDeliverables.filter((d) => d.passed).length
  }

  /**
   * Count blocked deliverables (excludes deprecated)
   */
  countBlocked(): number {
    return this.activeDeliverables.filter((d) => d.blocked).length
  }

  /**
   * Count deprecated deliverables
   */
  countDeprecated(): number {
    return this.deliverables.filter((d) => d.deprecated).length
  }

  /**
   * Check if all achievable (non-blocked) deliverables have passed (excludes deprecated)
   */
  allAchievablePassed(): boolean {
    const achievable = this.activeDeliverables.filter((d) => !d.blocked)
    if (achievable.length === 0) {
      return false
    }
    return achievable.every((d) => d.passed)
  }

  /**
   * Check if all deliverables are blocked (excludes deprecated)
   */
  allBlocked(): boolean {
    const active = this.activeDeliverables
    if (active.length === 0) {
      return false
    }
    return active.every((d) => d.blocked)
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
    return new DeliverableStatus(
      this.createdAt,
      updatedAt,
      this.deliverables as Deliverable[],
    )
  }
}

/**
 * Single deliverable input for batch creation
 */
export type DeliverableInput = {
  id: string
  description: string
  acceptanceCriteria: string[]
}

/**
 * Input for create_deliverable tool (batch creation)
 */
export type CreateDeliverableInput = {
  deliverables: DeliverableInput[]
}

/**
 * Notification payload for deliverable status changes
 */
export type DeliverableStatusNotification = {
  deliverableId: string
  deliverableDescription: string
  previousStatus: DeliverableStatusValue | undefined
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
export type SetDeliverableStatusInput = {
  deliverableId: string
  status: DeliverableStatusValue
}

/**
 * Input for deprecate_deliverable tool
 */
export type DeprecateDeliverableInput = {
  deliverableId: string
}

/**
 * Operation result returned by application services
 */
export type OperationResult = {
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
