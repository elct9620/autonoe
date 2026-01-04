import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  DeliverableRepository,
  CreateDeliverableInput,
  SetDeliverableStatusInput,
  DeliverableStatusCallback,
  DeliverableStatusValue,
} from '@autonoe/core'
import { createDeliverables, setDeliverableStatus } from '@autonoe/core'

/**
 * Tool result format for MCP tools
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
}

/**
 * Handler for create_deliverable tool (batch)
 * Extracted for testability
 */
export async function handleCreateDeliverables(
  repository: DeliverableRepository,
  input: CreateDeliverableInput,
): Promise<ToolResult> {
  const status = await repository.load()
  const { status: newStatus, result } = createDeliverables(status, input)

  if (result.success) {
    await repository.save(newStatus)
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  }
}

/**
 * Get deliverable status value from passed/blocked flags
 */
function getStatusValue(
  passed: boolean,
  blocked: boolean,
): DeliverableStatusValue {
  if (passed) return 'passed'
  if (blocked) return 'blocked'
  return 'pending'
}

/**
 * Handler for set_deliverable_status tool
 * Extracted for testability
 */
export async function handleSetDeliverableStatus(
  repository: DeliverableRepository,
  input: SetDeliverableStatusInput,
  onStatusChange?: DeliverableStatusCallback,
): Promise<ToolResult> {
  const status = await repository.load()

  // Find deliverable to get previous status
  const existingDeliverable = status.deliverables.find(
    (d) => d.id === input.deliverableId,
  )
  const previousStatus = existingDeliverable
    ? getStatusValue(existingDeliverable.passed, existingDeliverable.blocked)
    : null

  const { status: newStatus, result } = setDeliverableStatus(status, input)

  if (result.success) {
    await repository.save(newStatus)

    // Notify callback if provided
    if (onStatusChange && existingDeliverable) {
      onStatusChange({
        deliverableId: input.deliverableId,
        deliverableDescription: existingDeliverable.description,
        previousStatus,
        newStatus: input.status,
      })
    }
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  }
}

/**
 * Create an SDK MCP server with deliverable tools
 * @param repository - Repository for persisting deliverable status
 * @param onStatusChange - Optional callback for status change notifications
 * @returns SDK MCP server configuration with instance
 */
export function createDeliverableMcpServer(
  repository: DeliverableRepository,
  onStatusChange?: DeliverableStatusCallback,
) {
  const createDeliverableTool = tool(
    'create_deliverable',
    'Create one or more deliverables in status.json. Use this in the initialization phase to define work units.',
    {
      deliverables: z
        .array(
          z.object({
            id: z.string().describe('Unique deliverable ID (e.g., DL-001)'),
            description: z
              .string()
              .describe('Clear description of the deliverable'),
            acceptanceCriteria: z
              .array(z.string())
              .describe('List of verifiable completion conditions'),
          }),
        )
        .describe('Array of deliverables to create'),
    },
    (input) => handleCreateDeliverables(repository, input),
  )

  const setDeliverableStatusTool = tool(
    'set_deliverable_status',
    'Set deliverable status: pending (reset), passed (completed), or blocked (external constraints only). Document reason in .autonoe-note.md before blocking.',
    {
      deliverableId: z.string().describe('Deliverable ID to update'),
      status: z
        .enum(['pending', 'passed', 'blocked'])
        .describe(
          'Status: pending=reset, passed=completed, blocked=external constraints',
        ),
    },
    (input) => handleSetDeliverableStatus(repository, input, onStatusChange),
  )

  return createSdkMcpServer({
    name: 'autonoe-deliverable',
    version: '1.0.0',
    tools: [createDeliverableTool, setDeliverableStatusTool],
  })
}
