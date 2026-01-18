import type { InstructionName } from './instructions'

export type WorkflowType = 'run' | 'sync'
export type PhaseType = 'planning' | 'implementation'

/**
 * Workflow encapsulates the instruction pair for each command.
 * Immutable Value Object with static factory instances.
 *
 * @see SPEC.md Appendix A.4
 */
export class Workflow {
  private constructor(
    readonly type: WorkflowType,
    readonly planningInstruction: InstructionName,
    readonly implementationInstruction: InstructionName,
  ) {}

  /** Run command workflow: initializer → coding */
  static readonly run = new Workflow('run', 'initializer', 'coding')

  /** Sync command workflow: sync → verify */
  static readonly sync = new Workflow('sync', 'sync', 'verify')

  /** Get workflow by type */
  static fromType(type: WorkflowType): Workflow {
    return type === 'run' ? Workflow.run : Workflow.sync
  }

  /** Check if instruction is the planning phase of this workflow */
  isPlanningInstruction(instruction: InstructionName): boolean {
    return this.planningInstruction === instruction
  }

  /** Get the phase type for an instruction in this workflow */
  getPhaseType(instruction: InstructionName): PhaseType {
    return this.isPlanningInstruction(instruction)
      ? 'planning'
      : 'implementation'
  }
}

/** Sync command first session constant */
export const SYNC_FIRST_SESSION = 1
