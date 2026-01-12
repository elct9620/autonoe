/**
 * Deliverable application services
 * @see SPEC.md Section 3.5
 */

import { Deliverable } from './deliverable'
import {
  DeliverableStatus,
  type CreateDeliverableInput,
  type SetDeliverableStatusInput,
  type DeprecateDeliverableInput,
  type OperationResult,
} from './deliverableStatus'

/**
 * Error codes for deliverable service operations
 */
type ServiceErrorCode = 'VALIDATION_ERROR' | 'DUPLICATE_ID' | 'NOT_FOUND'

/**
 * Service result type alias
 */
type ServiceResult = { status: DeliverableStatus; result: OperationResult }

/**
 * Create a failure result with unchanged status
 */
function failure(
  status: DeliverableStatus,
  message: string,
  error: ServiceErrorCode,
): ServiceResult {
  return { status, result: { success: false, message, error } }
}

/**
 * Create a success result with updated status
 */
function success(status: DeliverableStatus, message: string): ServiceResult {
  return { status, result: { success: true, message } }
}

/**
 * Create one or more deliverables in the status (batch)
 * @returns Updated status and tool result
 */
export function createDeliverables(
  status: DeliverableStatus,
  input: CreateDeliverableInput,
): { status: DeliverableStatus; result: OperationResult } {
  // Validate batch is not empty
  if (!input.deliverables || input.deliverables.length === 0) {
    return failure(
      status,
      'At least one deliverable is required',
      'VALIDATION_ERROR',
    )
  }

  // Check for duplicate IDs within batch
  const batchIds = new Set<string>()
  for (const d of input.deliverables) {
    if (batchIds.has(d.id)) {
      return failure(status, `Duplicate ID "${d.id}" in batch`, 'DUPLICATE_ID')
    }
    batchIds.add(d.id)
  }

  // Process each deliverable
  const newDeliverables: Deliverable[] = []
  for (const deliverableInput of input.deliverables) {
    // Validate input
    if (!deliverableInput.id || deliverableInput.id.trim() === '') {
      return failure(status, 'Deliverable ID is required', 'VALIDATION_ERROR')
    }

    if (
      !deliverableInput.description ||
      deliverableInput.description.trim() === ''
    ) {
      return failure(
        status,
        'Deliverable description is required',
        'VALIDATION_ERROR',
      )
    }

    if (
      !deliverableInput.acceptanceCriteria ||
      deliverableInput.acceptanceCriteria.length === 0
    ) {
      return failure(
        status,
        'At least one acceptance criterion is required',
        'VALIDATION_ERROR',
      )
    }

    // Check for empty acceptance criteria
    if (
      deliverableInput.acceptanceCriteria.some((c) => !c || c.trim() === '')
    ) {
      return failure(
        status,
        'Acceptance criteria cannot be empty',
        'VALIDATION_ERROR',
      )
    }

    // Check for duplicate ID in existing status
    if (status.deliverables.some((d) => d.id === deliverableInput.id)) {
      return failure(
        status,
        `Deliverable with ID "${deliverableInput.id}" already exists`,
        'DUPLICATE_ID',
      )
    }

    // Create new deliverable
    newDeliverables.push(
      Deliverable.pending(
        deliverableInput.id,
        deliverableInput.description,
        deliverableInput.acceptanceCriteria,
      ),
    )
  }

  return success(
    status.withDeliverables([...status.deliverables, ...newDeliverables]),
    `Created ${input.deliverables.length} deliverable(s) successfully`,
  )
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
): { status: DeliverableStatus; result: OperationResult } {
  // Validate input
  if (!input.deliverableId || input.deliverableId.trim() === '') {
    return failure(status, 'Deliverable ID is required', 'VALIDATION_ERROR')
  }

  // Validate status value
  if (!['pending', 'passed', 'blocked'].includes(input.status)) {
    return failure(
      status,
      `Invalid status "${input.status}". Must be pending, passed, or blocked`,
      'VALIDATION_ERROR',
    )
  }

  // Find deliverable
  const index = status.deliverables.findIndex(
    (d) => d.id === input.deliverableId,
  )
  if (index === -1) {
    return failure(
      status,
      `Deliverable with ID "${input.deliverableId}" not found`,
      'NOT_FOUND',
    )
  }

  // Update deliverable using transition methods
  const existing = status.deliverables[index]!
  let updated: Deliverable

  switch (input.status) {
    case 'pending':
      updated = existing.reset()
      break
    case 'passed':
      updated = existing.markPassed()
      break
    case 'blocked':
      updated = existing.markBlocked()
      break
  }

  const updatedDeliverables = [
    ...status.deliverables.slice(0, index),
    updated,
    ...status.deliverables.slice(index + 1),
  ]

  return success(
    status.withDeliverables(updatedDeliverables),
    `Deliverable "${updated.description}" (${updated.id}) marked as ${input.status}`,
  )
}

/**
 * Mark a deliverable as deprecated
 * Sets deprecatedAt to current date (YYYY-MM-DD format)
 * @returns Updated status and tool result
 */
export function deprecateDeliverable(
  status: DeliverableStatus,
  input: DeprecateDeliverableInput,
): { status: DeliverableStatus; result: OperationResult } {
  // Validate input
  if (!input.deliverableId || input.deliverableId.trim() === '') {
    return failure(status, 'Deliverable ID is required', 'VALIDATION_ERROR')
  }

  // Find deliverable
  const index = status.deliverables.findIndex(
    (d) => d.id === input.deliverableId,
  )
  if (index === -1) {
    return failure(
      status,
      `Deliverable with ID "${input.deliverableId}" not found`,
      'NOT_FOUND',
    )
  }

  const existing = status.deliverables[index]!

  // Check if already deprecated
  if (existing.deprecated) {
    return failure(
      status,
      `Deliverable "${input.deliverableId}" is already deprecated`,
      'VALIDATION_ERROR',
    )
  }

  // Mark as deprecated
  const updated = existing.markDeprecated()

  const updatedDeliverables = [
    ...status.deliverables.slice(0, index),
    updated,
    ...status.deliverables.slice(index + 1),
  ]

  return success(
    status.withDeliverables(updatedDeliverables),
    `Deliverable "${existing.description}" (${existing.id}) marked as deprecated`,
  )
}
