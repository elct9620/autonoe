import type {
  InstructionSelector,
  InstructionSelectionContext,
  InstructionSelectionResult,
  InstructionResolver,
  InstructionName,
} from '@autonoe/core'

/**
 * Instruction selector for sync command
 *
 * Session 1 uses 'sync' instruction to parse SPEC.md and sync deliverables.
 * Session 2+ uses 'verify' instruction to validate implementation.
 *
 * @see SPEC.md Section 8.3.3, A.1
 */
export class SyncInstructionSelector implements InstructionSelector {
  constructor(private readonly resolver: InstructionResolver) {}

  async select(
    context: InstructionSelectionContext,
  ): Promise<InstructionSelectionResult> {
    const name: InstructionName = context.iteration === 1 ? 'sync' : 'verify'
    const content = await this.resolver.resolve(name)
    return { name, content }
  }
}
