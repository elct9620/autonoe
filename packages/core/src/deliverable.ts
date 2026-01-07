/**
 * Deliverable entity - an immutable verifiable work unit with acceptance criteria
 * @see SPEC.md Section 2.3 Domain Model
 */

/**
 * Deliverable status values
 * - pending: reset state (passed=false, blocked=false)
 * - passed: completed (passed=true, blocked=false)
 * - blocked: external constraints (passed=false, blocked=true)
 */
export type DeliverableStatusValue = 'pending' | 'passed' | 'blocked'

/**
 * Deliverable entity - an immutable verifiable work unit with acceptance criteria
 *
 * Invariant: passed and blocked are mutually exclusive
 * - pending: passed=false, blocked=false
 * - passed: passed=true, blocked=false
 * - blocked: passed=false, blocked=true
 */
export class Deliverable {
  readonly id: string
  readonly description: string
  readonly acceptanceCriteria: readonly string[]
  readonly passed: boolean
  readonly blocked: boolean

  private constructor(
    id: string,
    description: string,
    acceptanceCriteria: string[],
    passed: boolean,
    blocked: boolean,
  ) {
    this.id = id
    this.description = description
    this.acceptanceCriteria = acceptanceCriteria
    this.passed = passed
    this.blocked = blocked
  }

  /**
   * Factory method for deserialization (backward compatibility with JSON)
   */
  static create(
    id: string,
    description: string,
    acceptanceCriteria: string[],
    passed: boolean,
    blocked: boolean,
  ): Deliverable {
    return new Deliverable(id, description, acceptanceCriteria, passed, blocked)
  }

  /**
   * Create a deliverable in pending state
   */
  static pending(
    id: string,
    description: string,
    acceptanceCriteria: string[],
  ): Deliverable {
    return new Deliverable(id, description, acceptanceCriteria, false, false)
  }

  /**
   * Create a deliverable in passed state
   */
  static passed(
    id: string,
    description: string,
    acceptanceCriteria: string[],
  ): Deliverable {
    return new Deliverable(id, description, acceptanceCriteria, true, false)
  }

  /**
   * Create a deliverable in blocked state
   */
  static blocked(
    id: string,
    description: string,
    acceptanceCriteria: string[],
  ): Deliverable {
    return new Deliverable(id, description, acceptanceCriteria, false, true)
  }

  /**
   * Transition to passed state
   * @returns New Deliverable instance with passed=true, blocked=false
   */
  markPassed(): Deliverable {
    return new Deliverable(
      this.id,
      this.description,
      [...this.acceptanceCriteria],
      true,
      false,
    )
  }

  /**
   * Transition to blocked state
   * @returns New Deliverable instance with passed=false, blocked=true
   */
  markBlocked(): Deliverable {
    return new Deliverable(
      this.id,
      this.description,
      [...this.acceptanceCriteria],
      false,
      true,
    )
  }

  /**
   * Reset to pending state
   * @returns New Deliverable instance with passed=false, blocked=false
   */
  reset(): Deliverable {
    return new Deliverable(
      this.id,
      this.description,
      [...this.acceptanceCriteria],
      false,
      false,
    )
  }

  /**
   * Get the current status as a semantic value
   */
  getStatus(): DeliverableStatusValue {
    if (this.passed) return 'passed'
    if (this.blocked) return 'blocked'
    return 'pending'
  }
}
