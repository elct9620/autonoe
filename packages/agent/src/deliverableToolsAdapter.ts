import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  DeliverableRepository,
  CreateDeliverableInput,
  SetDeliverableStatusInput,
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
 * Handler for set_deliverable_status tool
 * Extracted for testability
 */
export async function handleSetDeliverableStatus(
  repository: DeliverableRepository,
  input: SetDeliverableStatusInput,
): Promise<ToolResult> {
  const status = await repository.load()
  const { status: newStatus, result } = setDeliverableStatus(status, input)

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
    'Create one or more deliverables in status.json. Use this in the initialization phase to define work units.',
    {
      deliverables: z
        .array(
          z.object({
            id: z.string().describe('Unique deliverable ID (e.g., DL-001)'),
            name: z.string().describe('Human-readable deliverable name'),
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
    'Set deliverable status: pending (reset), passed (completed), or blocked (external constraints only). Document reason in .autonoe-note.txt before blocking.',
    {
      deliverableId: z.string().describe('Deliverable ID to update'),
      status: z
        .enum(['pending', 'passed', 'blocked'])
        .describe(
          'Status: pending=reset, passed=completed, blocked=external constraints',
        ),
    },
    (input) => handleSetDeliverableStatus(repository, input),
  )

  return createSdkMcpServer({
    name: 'autonoe-deliverable',
    version: '1.0.0',
    tools: [createDeliverableTool, setDeliverableStatusTool],
  })
}
