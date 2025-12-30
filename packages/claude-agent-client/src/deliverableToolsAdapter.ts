import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  DeliverableRepository,
  CreateDeliverableInput,
  UpdateDeliverableInput,
} from '@autonoe/core'
import { createDeliverable, updateDeliverable } from '@autonoe/core'

/**
 * Tool result format for MCP tools
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
}

/**
 * Handler for create_deliverable tool
 * Extracted for testability
 */
export async function handleCreateDeliverable(
  repository: DeliverableRepository,
  input: CreateDeliverableInput,
): Promise<ToolResult> {
  const status = await repository.load()
  const { status: newStatus, result } = createDeliverable(status, input)

  if (result.success) {
    await repository.save(newStatus)
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  }
}

/**
 * Handler for update_deliverable tool
 * Extracted for testability
 */
export async function handleUpdateDeliverable(
  repository: DeliverableRepository,
  input: UpdateDeliverableInput,
): Promise<ToolResult> {
  const status = await repository.load()
  const { status: newStatus, result } = updateDeliverable(status, input)

  if (result.success) {
    await repository.save(newStatus)
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  }
}

/**
 * Create an SDK MCP server with deliverable tools
 * @param repository - Repository for persisting deliverable status
 * @returns SDK MCP server configuration with instance
 */
export function createDeliverableMcpServer(repository: DeliverableRepository) {
  const createDeliverableTool = tool(
    'create_deliverable',
    'Create a new deliverable with acceptance criteria. Use this in the initialization phase to define work units.',
    {
      id: z.string().describe('Unique deliverable ID (e.g., DL-001)'),
      name: z.string().describe('Human-readable deliverable name'),
      acceptanceCriteria: z
        .array(z.string())
        .describe('List of verifiable completion conditions'),
    },
    (input) => handleCreateDeliverable(repository, input),
  )

  const updateDeliverableTool = tool(
    'update_deliverable',
    'Update deliverable verification status. Use this after implementing and verifying a deliverable.',
    {
      deliverableId: z.string().describe('Deliverable ID to update'),
      passed: z.boolean().describe('Whether deliverable passed verification'),
    },
    (input) => handleUpdateDeliverable(repository, input),
  )

  return createSdkMcpServer({
    name: 'autonoe-deliverable',
    version: '1.0.0',
    tools: [createDeliverableTool, updateDeliverableTool],
  })
}
