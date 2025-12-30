import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { DeliverableRepository } from '@autonoe/core'
import { createDeliverable, updateDeliverable } from '@autonoe/core'

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
    async (input) => {
      const status = await repository.load()
      const { status: newStatus, result } = createDeliverable(status, input)

      if (result.success) {
        await repository.save(newStatus)
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      }
    },
  )

  const updateDeliverableTool = tool(
    'update_deliverable',
    'Update deliverable verification status. Use this after implementing and verifying a deliverable.',
    {
      deliverableId: z.string().describe('Deliverable ID to update'),
      passed: z.boolean().describe('Whether deliverable passed verification'),
    },
    async (input) => {
      const status = await repository.load()
      const { status: newStatus, result } = updateDeliverable(status, input)

      if (result.success) {
        await repository.save(newStatus)
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      }
    },
  )

  return createSdkMcpServer({
    name: 'autonoe-deliverable',
    version: '1.0.0',
    tools: [createDeliverableTool, updateDeliverableTool],
  })
}
