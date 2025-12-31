/**
 * Instruction system for guiding the coding agent
 * @see SPEC.md Appendix A
 */

import initializerInstruction from './instructions/initializer.md' with { type: 'text' }
import codingInstruction from './instructions/coding.md' with { type: 'text' }
import type { DeliverableStatusReader } from './deliverableStatus'

export { initializerInstruction, codingInstruction }

/**
 * Instruction name type
 */
export type InstructionName = 'initializer' | 'coding'

/**
 * Interface for resolving instructions with optional override support
 * Implementation in CLI layer handles filesystem access for overrides
 */
export interface InstructionResolver {
  resolve(name: InstructionName): Promise<string>
}

/**
 * Default resolver that returns built-in instructions
 * Use this when no override resolution is needed
 */
export function createDefaultInstructionResolver(): InstructionResolver {
  return {
    async resolve(name: InstructionName): Promise<string> {
      return name === 'initializer' ? initializerInstruction : codingInstruction
    },
  }
}

/**
 * Select the appropriate instruction based on deliverable status existence
 * @param statusReader - Reader to check if status.json exists
 * @param resolver - Resolver to get instruction content (with optional overrides)
 * @returns The instruction content for the current phase
 * @see SPEC.md Section 7.2
 */
export async function selectInstruction(
  statusReader: DeliverableStatusReader,
  resolver: InstructionResolver,
): Promise<string> {
  const statusExists = await statusReader.exists()
  const name: InstructionName = statusExists ? 'coding' : 'initializer'
  return resolver.resolve(name)
}
