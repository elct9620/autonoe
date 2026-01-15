import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  DeliverableRepository,
  CreateDeliverableInput,
  SetDeliverableStatusInput,
  DeprecateDeliverableInput,
  DeliverableStatusCallback,
} from '@autonoe/core'
import {
  createDeliverables,
  setDeliverableStatus,
  deprecateDeliverable,
  VerificationTracker,
} from '@autonoe/core'

/**
 * MCP tool output format (SDK required structure)
 */
type McpToolOutput = { content: Array<{ type: 'text'; text: string }> }

/**
 * Available tool names for deliverable operations
 */
export type DeliverableToolName =
  | 'create'
  | 'set_status'
  | 'deprecate'
  | 'verify'
  | 'list'

/**
 * Predefined tool sets for different instruction types
 * Each instruction type has a specific set of tools available
 * @see SPEC.md Section 3.2 Deliverable Tools
 */
export const DELIVERABLE_TOOL_SETS = {
  initializer: ['create'] as const,
  coding: ['set_status', 'list'] as const,
  sync: ['create', 'deprecate', 'list'] as const,
  verify: ['set_status', 'verify', 'list'] as const,
} as const

export type DeliverableToolSetName = keyof typeof DELIVERABLE_TOOL_SETS

const MCP_SERVER_NAME = 'autonoe'

/**
 * Result of creating a deliverable MCP server
 */
export interface DeliverableMcpServerResult {
  server: ReturnType<typeof createSdkMcpServer>
  allowedTools: string[]
}

/**
 * Options for creating MCP server
 */
export interface DeliverableMcpServerOptions {
  toolSet?: DeliverableToolSetName | DeliverableToolName[]
  onStatusChange?: DeliverableStatusCallback
  verificationTracker?: VerificationTracker
}

/**
 * Handler for create_deliverable tool (batch)
 * Extracted for testability
 */
export async function handleCreateDeliverables(
  repository: DeliverableRepository,
  input: CreateDeliverableInput,
): Promise<McpToolOutput> {
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
  onStatusChange?: DeliverableStatusCallback,
): Promise<McpToolOutput> {
  const status = await repository.load()

  // Find deliverable to get previous status
  const existingDeliverable = status.deliverables.find(
    (d) => d.id === input.deliverableId,
  )
  const previousStatus = existingDeliverable?.status

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
 * Handler for deprecate_deliverable tool
 * Extracted for testability
 */
export async function handleDeprecateDeliverable(
  repository: DeliverableRepository,
  input: DeprecateDeliverableInput,
): Promise<McpToolOutput> {
  const status = await repository.load()
  const { status: newStatus, result } = deprecateDeliverable(status, input)

  if (result.success) {
    await repository.save(newStatus)
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  }
}

/**
 * Input for verify_deliverable tool
 */
export type VerifyDeliverableInput = {
  deliverableId: string
}

/**
 * Handler for verify_deliverable tool
 * Marks a deliverable as verified (checked by agent)
 */
export async function handleVerifyDeliverable(
  tracker: VerificationTracker,
  input: VerifyDeliverableInput,
): Promise<McpToolOutput> {
  const success = tracker.verify(input.deliverableId)
  const result = {
    success,
    message: success
      ? `Deliverable ${input.deliverableId} marked as verified`
      : `Deliverable ${input.deliverableId} not found in tracker`,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  }
}

/**
 * Filter options for list_deliverables tool
 */
export type ListDeliverableFilter = {
  status?: 'pending' | 'passed' | 'blocked'
  verified?: boolean
}

/**
 * Input for list_deliverables tool
 */
export type ListDeliverablesInput = {
  filter?: ListDeliverableFilter
  limit?: number
}

/**
 * Handler for list_deliverables tool
 * Lists deliverables with optional filtering
 */
export async function handleListDeliverables(
  repository: DeliverableRepository,
  tracker: VerificationTracker | undefined,
  input: ListDeliverablesInput,
): Promise<McpToolOutput> {
  const limit = input.limit ?? 5
  const status = await repository.load()

  let deliverables = status.activeDeliverables

  // Filter by deliverable status
  if (input.filter?.status) {
    deliverables = deliverables.filter((d) => {
      switch (input.filter!.status) {
        case 'pending':
          return !d.passed && !d.blocked
        case 'passed':
          return d.passed
        case 'blocked':
          return d.blocked
        default:
          return true
      }
    })
  }

  // Filter by verification status (only available when tracker is provided)
  if (input.filter?.verified !== undefined && tracker) {
    deliverables = deliverables.filter(
      (d) => tracker.isVerified(d.id) === input.filter!.verified,
    )
  }

  // Apply limit and format output
  const limitedDeliverables = deliverables.slice(0, limit).map((d) => ({
    id: d.id,
    description: d.description,
    status: d.status,
    acceptanceCriteria: d.acceptanceCriteria,
  }))

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ deliverables: limitedDeliverables }),
      },
    ],
  }
}

/**
 * Create an SDK MCP server with configurable deliverable tools
 * @param repository - Repository for persisting deliverable status
 * @param options - Configuration options including tool set and callbacks
 * @returns Object containing the MCP server and allowed tool names
 */
export function createDeliverableMcpServer(
  repository: DeliverableRepository,
  options: DeliverableMcpServerOptions = {},
): DeliverableMcpServerResult {
  const { toolSet = 'coding', onStatusChange, verificationTracker } = options

  // Resolve tool names from toolSet
  const toolNames: readonly DeliverableToolName[] = Array.isArray(toolSet)
    ? toolSet
    : DELIVERABLE_TOOL_SETS[toolSet]

  // Generate fully qualified MCP tool names
  const allowedTools = toolNames.map(
    (name) => `mcp__${MCP_SERVER_NAME}__${name}`,
  )

  // Define all available tools
  const createTool = tool(
    'create',
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

  const setStatusTool = tool(
    'set_status',
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

  const deprecateTool = tool(
    'deprecate',
    'Mark a deliverable as deprecated. Used during sync when deliverables are removed from SPEC.md. Deprecated deliverables are excluded from termination evaluation.',
    {
      deliverableId: z.string().describe('Deliverable ID to deprecate'),
    },
    (input) => handleDeprecateDeliverable(repository, input),
  )

  const verifyTool = tool(
    'verify',
    'Mark a deliverable as verified (checked). Use this after checking a deliverable to confirm you have reviewed it, regardless of pass/block status.',
    {
      deliverableId: z.string().describe('Deliverable ID to mark as verified'),
    },
    (input) => {
      if (!verificationTracker) {
        return Promise.resolve({
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                message: 'Verification tracker not available',
              }),
            },
          ],
        })
      }
      return handleVerifyDeliverable(verificationTracker, input)
    },
  )

  const listTool = tool(
    'list',
    'List deliverables with optional filtering. Use filter.status for pending/passed/blocked. Use filter.verified for unverified (verify mode only).',
    {
      filter: z
        .object({
          status: z
            .enum(['pending', 'passed', 'blocked'])
            .optional()
            .describe('Filter by deliverable status'),
          verified: z
            .boolean()
            .optional()
            .describe(
              'Filter by verification status (only available in verify mode)',
            ),
        })
        .optional()
        .describe('Filter criteria'),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe('Maximum number of deliverables to return (default: 5)'),
    },
    (input) => handleListDeliverables(repository, verificationTracker, input),
  )

  // Map tool names to tool instances
  const toolMap = {
    create: createTool,
    set_status: setStatusTool,
    deprecate: deprecateTool,
    verify: verifyTool,
    list: listTool,
  } as const

  // Select tools based on tool set
  const selectedTools = toolNames.map((name) => toolMap[name])

  const server = createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: '1.0.0',
    tools: selectedTools,
  })

  return { server, allowedTools }
}
