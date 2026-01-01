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
 * Single deliverable input for batch creation
 */
export interface DeliverableInput {
  id: string
  name: string
  acceptanceCriteria: string[]
}

/**
 * Input for create_deliverable tool (batch creation)
 */
export interface CreateDeliverableInput {
  deliverables: DeliverableInput[]
}

/**
 * Input for set_deliverable_status tool
 */
export interface SetDeliverableStatusInput {
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
 * Set deliverable verification status
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
