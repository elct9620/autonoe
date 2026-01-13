import type { DeliverableStatusReader } from './deliverableStatus'
import type { InstructionResolver } from './instructions'

/**
 * Context provided to instruction selector
 */
export interface InstructionSelectionContext {
  iteration: number
  statusReader: DeliverableStatusReader
}

/**
 * Strategy interface for selecting instructions per session
 *
 * Allows different commands to implement their own instruction selection logic
 * without coupling SessionRunner to specific behaviors.
 */
export interface InstructionSelector {
  select(context: InstructionSelectionContext): Promise<string>
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

  async select(context: InstructionSelectionContext): Promise<string> {
    const statusExists = await context.statusReader.exists()
    const name = statusExists ? 'coding' : 'initializer'
    return this.resolver.resolve(name)
  }
}
