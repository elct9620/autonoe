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
 */
export interface DeliverableStatus {
  createdAt: string
  updatedAt: string
  deliverables: Deliverable[]
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
