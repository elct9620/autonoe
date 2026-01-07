/**
 * Deliverable application services and query predicates
 * @see SPEC.md Section 3.5
 */

import type {
  Deliverable,
  DeliverableStatus,
  DeliverableInput,
  CreateDeliverableInput,
  SetDeliverableStatusInput,
  ToolResult,
} from './deliverableStatus'

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
  const newDeliverables: Deliverable[] = []
  for (const deliverableInput of input.deliverables) {
    // Validate input
    if (!deliverableInput.id || deliverableInput.id.trim() === '') {
      return {
        status,
        result: {
          success: false,
          message: 'Deliverable ID is required',
          error: 'VALIDATION_ERROR',
        },
      }
    }

    if (
      !deliverableInput.description ||
      deliverableInput.description.trim() === ''
    ) {
      return {
        status,
        result: {
          success: false,
          message: 'Deliverable description is required',
          error: 'VALIDATION_ERROR',
        },
      }
    }

    if (
      !deliverableInput.acceptanceCriteria ||
      deliverableInput.acceptanceCriteria.length === 0
    ) {
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
    if (
      deliverableInput.acceptanceCriteria.some((c) => !c || c.trim() === '')
    ) {
      return {
        status,
        result: {
          success: false,
          message: 'Acceptance criteria cannot be empty',
          error: 'VALIDATION_ERROR',
        },
      }
    }

    // Check for duplicate ID in existing status
    if (status.deliverables.some((d) => d.id === deliverableInput.id)) {
      return {
        status,
        result: {
          success: false,
          message: `Deliverable with ID "${deliverableInput.id}" already exists`,
          error: 'DUPLICATE_ID',
        },
      }
    }

    // Create new deliverable
    newDeliverables.push({
      id: deliverableInput.id,
      description: deliverableInput.description,
      acceptanceCriteria: deliverableInput.acceptanceCriteria,
      passed: false,
      blocked: false,
    })
  }

  return {
    status: {
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
      deliverables: [...status.deliverables, ...newDeliverables],
    },
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
