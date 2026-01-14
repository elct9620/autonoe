/**
 * VerificationTracker - In-memory tracker for sync command verification
 * Tracks which deliverables have been checked by the agent
 * @see SPEC.md Section 3.2 Deliverable Tools
 */

import type { DeliverableStatus } from './deliverableStatus'

/**
 * Tracks verification state for deliverables during sync command
 * Used to ensure all deliverables are explicitly checked before termination
 */
export class VerificationTracker {
  private readonly _allIds: Set<string>
  private readonly _verifiedIds: Set<string>

  private constructor(deliverableIds: string[]) {
    this._allIds = new Set(deliverableIds)
    this._verifiedIds = new Set()
  }

  /**
   * Factory method to create tracker from DeliverableStatus
   * Only includes active (non-deprecated) deliverables
   */
  static fromStatus(status: DeliverableStatus): VerificationTracker {
    const activeIds = status.activeDeliverables.map((d) => d.id)
    return new VerificationTracker(activeIds)
  }

  /**
   * Factory method to create tracker from deliverable IDs
   */
  static fromIds(ids: string[]): VerificationTracker {
    return new VerificationTracker(ids)
  }

  /**
   * Factory method to create empty tracker
   */
  static empty(): VerificationTracker {
    return new VerificationTracker([])
  }

  /**
   * Mark a deliverable as verified
   * Returns false if the deliverable ID is not tracked
   */
  verify(id: string): boolean {
    if (!this._allIds.has(id)) {
      return false
    }
    this._verifiedIds.add(id)
    return true
  }

  /**
   * Check if a deliverable has been verified
   */
  isVerified(id: string): boolean {
    return this._verifiedIds.has(id)
  }

  /**
   * Check if all tracked deliverables have been verified
   */
  allVerified(): boolean {
    if (this._allIds.size === 0) {
      return true
    }
    return this._allIds.size === this._verifiedIds.size
  }

  /**
   * Get IDs of deliverables that have not been verified
   */
  unverifiedIds(): string[] {
    return [...this._allIds].filter((id) => !this._verifiedIds.has(id))
  }

  /**
   * Get count of verified deliverables
   */
  get verifiedCount(): number {
    return this._verifiedIds.size
  }

  /**
   * Get total count of tracked deliverables
   */
  get totalCount(): number {
    return this._allIds.size
  }
}
