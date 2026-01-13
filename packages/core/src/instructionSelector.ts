import type { DeliverableStatusReader } from './deliverableStatus'
import type { InstructionName, InstructionResolver } from './instructions'

/**
 * Context provided to instruction selector
 */
export interface InstructionSelectionContext {
  iteration: number
  statusReader: DeliverableStatusReader
}

/**
 * Result from instruction selection
 * Contains both the instruction name (for tool set selection) and content
 */
export interface InstructionSelectionResult {
  name: InstructionName
  content: string
}

/**
 * Strategy interface for selecting instructions per session
 *
 * Allows different commands to implement their own instruction selection logic
 * without coupling SessionRunner to specific behaviors.
 *
 * Returns both instruction name and content so that SessionRunner can
 * pass the name to AgentClientFactory for tool set selection.
 */
export interface InstructionSelector {
  select(
    context: InstructionSelectionContext,
  ): Promise<InstructionSelectionResult>
}

/**
 * Default instruction selector for run command
 *
 * Selects instruction based on status.json existence:
 * - No status.json: use 'initializer' instruction
 * - Has status.json: use 'coding' instruction
 *
 * @see SPEC.md Section A.1
 */
export class DefaultInstructionSelector implements InstructionSelector {
  constructor(private readonly resolver: InstructionResolver) {}

  async select(
    context: InstructionSelectionContext,
  ): Promise<InstructionSelectionResult> {
    const statusExists = await context.statusReader.exists()
    const name: InstructionName = statusExists ? 'coding' : 'initializer'
    const content = await this.resolver.resolve(name)
    return { name, content }
  }
}
