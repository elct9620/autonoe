/**
 * Deliverable domain types and application services
 * @see SPEC.md Section 3.5, 5.2
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

/**
 * Create a single deliverable in the status (internal helper)
 * @returns Updated status and tool result
 */
function createSingleDeliverable(
  status: DeliverableStatus,
  input: DeliverableInput,
): { status: DeliverableStatus; result: ToolResult } {
  // Validate input
  if (!input.id || input.id.trim() === '') {
    return {
      status,
      result: {
        success: false,
        message: 'Deliverable ID is required',
        error: 'VALIDATION_ERROR',
      },
    }
  }

  if (!input.description || input.description.trim() === '') {
    return {
      status,
      result: {
        success: false,
        message: 'Deliverable description is required',
        error: 'VALIDATION_ERROR',
      },
    }
  }

  if (!input.acceptanceCriteria || input.acceptanceCriteria.length === 0) {
    return {
      status,
      result: {
        success: false,
        message: 'At least one acceptance criterion is required',
        error: 'VALIDATION_ERROR',
      },
    }
  }

  // Check for empty acceptance criteria
  if (input.acceptanceCriteria.some((c) => !c || c.trim() === '')) {
    return {
      status,
      result: {
        success: false,
        message: 'Acceptance criteria cannot be empty',
        error: 'VALIDATION_ERROR',
      },
    }
  }

  // Check for duplicate ID
  if (status.deliverables.some((d) => d.id === input.id)) {
    return {
      status,
      result: {
        success: false,
        message: `Deliverable with ID "${input.id}" already exists`,
        error: 'DUPLICATE_ID',
      },
    }
  }

  // Create new deliverable
  const newDeliverable: Deliverable = {
    id: input.id,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    passed: false,
    blocked: false,
  }

  return {
    status: {
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
      deliverables: [...status.deliverables, newDeliverable],
    },
    result: {
      success: true,
      message: `Deliverable "${input.description}" (${input.id}) created successfully`,
    },
  }
}

/**
 * Create one or more deliverables in the status (batch)
 * @returns Updated status and tool result
 */
export function createDeliverables(
  status: DeliverableStatus,
  input: CreateDeliverableInput,
): { status: DeliverableStatus; result: ToolResult } {
  // Validate batch is not empty
  if (!input.deliverables || input.deliverables.length === 0) {
    return {
      status,
      result: {
        success: false,
        message: 'At least one deliverable is required',
        error: 'VALIDATION_ERROR',
      },
    }
  }

  // Check for duplicate IDs within batch
  const batchIds = new Set<string>()
  for (const d of input.deliverables) {
    if (batchIds.has(d.id)) {
      return {
        status,
        result: {
          success: false,
          message: `Duplicate ID "${d.id}" in batch`,
          error: 'DUPLICATE_ID',
        },
      }
    }
    batchIds.add(d.id)
  }

  // Process each deliverable
  let currentStatus = status
  for (const deliverableInput of input.deliverables) {
    const singleResult = createSingleDeliverable(
      currentStatus,
      deliverableInput,
    )
    if (!singleResult.result.success) {
      return singleResult // Fail fast on first error
    }
    currentStatus = singleResult.status
  }

  return {
    status: currentStatus,
    result: {
      success: true,
      message: `Created ${input.deliverables.length} deliverable(s) successfully`,
    },
  }
}

/**
 * Set deliverable status
 * - pending: reset state (passed=false, blocked=false)
 * - passed: completed (passed=true, blocked=false)
 * - blocked: external constraints (passed=false, blocked=true)
 * @returns Updated status and tool result
 */
export function setDeliverableStatus(
  status: DeliverableStatus,
  input: SetDeliverableStatusInput,
): { status: DeliverableStatus; result: ToolResult } {
  // Validate input
  if (!input.deliverableId || input.deliverableId.trim() === '') {
    return {
      status,
      result: {
        success: false,
        message: 'Deliverable ID is required',
        error: 'VALIDATION_ERROR',
      },
    }
  }

  // Validate status value
  if (!['pending', 'passed', 'blocked'].includes(input.status)) {
    return {
      status,
      result: {
        success: false,
        message: `Invalid status "${input.status}". Must be pending, passed, or blocked`,
        error: 'VALIDATION_ERROR',
      },
    }
  }

  // Find deliverable
  const index = status.deliverables.findIndex(
    (d) => d.id === input.deliverableId,
  )
  if (index === -1) {
    return {
      status,
      result: {
        success: false,
        message: `Deliverable with ID "${input.deliverableId}" not found`,
        error: 'NOT_FOUND',
      },
    }
  }

  // Determine passed and blocked values based on status
  let passed: boolean
  let blocked: boolean

  switch (input.status) {
    case 'pending':
      passed = false
      blocked = false
      break
    case 'passed':
      passed = true
      blocked = false
      break
    case 'blocked':
      passed = false
      blocked = true
      break
  }

  // Update deliverable (index is guaranteed to be valid after findIndex check)
  const existing = status.deliverables[index]!
  const updated: Deliverable = {
    id: existing.id,
    description: existing.description,
    acceptanceCriteria: existing.acceptanceCriteria,
    passed,
    blocked,
  }

  const updatedDeliverables = [
    ...status.deliverables.slice(0, index),
    updated,
    ...status.deliverables.slice(index + 1),
  ]

  return {
    status: {
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
      deliverables: updatedDeliverables,
    },
    result: {
      success: true,
      message: `Deliverable "${updated.description}" (${updated.id}) marked as ${input.status}`,
    },
  }
}

/**
 * Check if all deliverables have passed
 */
export function allDeliverablesPassed(status: DeliverableStatus): boolean {
  if (status.deliverables.length === 0) {
    return false
  }
  return status.deliverables.every((d) => d.passed)
}

/**
 * Count passed deliverables
 */
export function countPassedDeliverables(status: DeliverableStatus): number {
  return status.deliverables.filter((d) => d.passed).length
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]!
}

/**
 * Create an empty DeliverableStatus
 */
export function emptyDeliverableStatus(): DeliverableStatus {
  const now = getCurrentDate()
  return { createdAt: now, updatedAt: now, deliverables: [] }
}

/**
 * Check if all achievable (non-blocked) deliverables have passed
 */
export function allAchievableDeliverablesPassed(
  status: DeliverableStatus,
): boolean {
  const achievable = status.deliverables.filter((d) => !d.blocked)
  if (achievable.length === 0) {
    return false
  }
  return achievable.every((d) => d.passed)
}

/**
 * Check if there are any blocked deliverables
 */
export function hasBlockedDeliverables(status: DeliverableStatus): boolean {
  return status.deliverables.some((d) => d.blocked)
}

/**
 * Count blocked deliverables
 */
export function countBlockedDeliverables(status: DeliverableStatus): number {
  return status.deliverables.filter((d) => d.blocked).length
}

/**
 * Check if all deliverables are blocked
 */
export function allDeliverablesBlocked(status: DeliverableStatus): boolean {
  if (status.deliverables.length === 0) {
    return false
  }
  return status.deliverables.every((d) => d.blocked)
}
