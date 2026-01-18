import {
  SYNC_FIRST_SESSION,
  type InstructionSelector,
  type InstructionSelectionContext,
  type InstructionSelectionResult,
  type InstructionResolver,
  type InstructionName,
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
    const name: InstructionName =
      context.iteration === SYNC_FIRST_SESSION ? 'sync' : 'verify'
    const content = await this.resolver.resolve(name)
    return { name, content }
  }
}
