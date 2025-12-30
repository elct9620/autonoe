/**
 * Deliverable domain types and application services
 * @see SPEC.md Section 3.5, 5.2
 */

/**
 * Deliverable entity - a verifiable work unit with acceptance criteria
 */
export interface Deliverable {
  id: string
  name: string
  acceptanceCriteria: string[]
  passed: boolean
}

/**
 * DeliverableStatus aggregate root - persisted in .autonoe/status.json
 */
export interface DeliverableStatus {
  deliverables: Deliverable[]
}

/**
 * Input for create_deliverable tool
 */
export interface CreateDeliverableInput {
  id: string
  name: string
  acceptanceCriteria: string[]
}

/**
 * Input for update_deliverable tool
 */
export interface UpdateDeliverableInput {
  deliverableId: string
  passed: boolean
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
 * Implementation lives in infrastructure layer (claude-agent-client)
 */
export interface DeliverableRepository extends DeliverableStatusReader {
  save(status: DeliverableStatus): Promise<void>
}

/**
 * Create a new deliverable in the status
 * @returns Updated status and tool result
 */
export function createDeliverable(
  status: DeliverableStatus,
  input: CreateDeliverableInput,
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

  if (!input.name || input.name.trim() === '') {
    return {
      status,
      result: {
        success: false,
        message: 'Deliverable name is required',
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
    name: input.name,
    acceptanceCriteria: input.acceptanceCriteria,
    passed: false,
  }

  return {
    status: {
      deliverables: [...status.deliverables, newDeliverable],
    },
    result: {
      success: true,
      message: `Deliverable "${input.name}" (${input.id}) created successfully`,
    },
  }
}

/**
 * Update deliverable verification status
 * @returns Updated status and tool result
 */
export function updateDeliverable(
  status: DeliverableStatus,
  input: UpdateDeliverableInput,
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

  // Update deliverable (index is guaranteed to be valid after findIndex check)
  const existing = status.deliverables[index]!
  const updated: Deliverable = {
    id: existing.id,
    name: existing.name,
    acceptanceCriteria: existing.acceptanceCriteria,
    passed: input.passed,
  }

  const updatedDeliverables = [
    ...status.deliverables.slice(0, index),
    updated,
    ...status.deliverables.slice(index + 1),
  ]

  const statusText = input.passed ? 'passed' : 'failed'

  return {
    status: {
      deliverables: updatedDeliverables,
    },
    result: {
      success: true,
      message: `Deliverable "${updated.name}" (${updated.id}) marked as ${statusText}`,
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
 * Create an empty DeliverableStatus
 */
export function emptyDeliverableStatus(): DeliverableStatus {
  return { deliverables: [] }
}
