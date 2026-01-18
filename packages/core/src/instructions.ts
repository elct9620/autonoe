/**
 * Instruction system for guiding the coding agent
 * @see SPEC.md Appendix A
 */

import initializerInstruction from './instructions/initializer.md' with { type: 'text' }
import codingInstruction from './instructions/coding.md' with { type: 'text' }
import syncInstruction from './instructions/sync.md' with { type: 'text' }
import verifyInstruction from './instructions/verify.md' with { type: 'text' }

export {
  initializerInstruction,
  codingInstruction,
  syncInstruction,
  verifyInstruction,
}

/**
 * Instruction name type
 */
export type InstructionName = 'initializer' | 'coding' | 'sync' | 'verify'

/**
 * Default instructions mapping
 */
export const defaultInstructions: Record<InstructionName, string> = {
  initializer: initializerInstruction,
  coding: codingInstruction,
  sync: syncInstruction,
  verify: verifyInstruction,
}

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
      return defaultInstructions[name]
    },
  }
}
