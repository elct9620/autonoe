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
 * Uses single status field to eliminate invalid state combinations.
 * Provides `passed` and `blocked` getters for backward compatibility.
 */
export class Deliverable {
  readonly id: string
  readonly description: string
  readonly acceptanceCriteria: readonly string[]
  private readonly _status: DeliverableStatusValue
  readonly deprecatedAt: string | undefined

  private constructor(
    id: string,
    description: string,
    acceptanceCriteria: string[],
    status: DeliverableStatusValue,
    deprecatedAt?: string,
  ) {
    this.id = id
    this.description = description
    this.acceptanceCriteria = acceptanceCriteria
    this._status = status
    this.deprecatedAt = deprecatedAt
  }

  /**
   * Whether the deliverable has passed (backward compatibility getter)
   */
  get passed(): boolean {
    return this._status === 'passed'
  }

  /**
   * Whether the deliverable is blocked (backward compatibility getter)
   */
  get blocked(): boolean {
    return this._status === 'blocked'
  }

  /**
   * Get the current status value
   */
  get status(): DeliverableStatusValue {
    return this._status
  }

  /**
   * Whether the deliverable is deprecated
   */
  get deprecated(): boolean {
    return this.deprecatedAt !== undefined
  }

  /**
   * Factory method for deserialization (backward compatibility with JSON)
   * Converts legacy (passed, blocked) booleans to status value
   * @param deprecatedAt - Optional deprecation date (YYYY-MM-DD format)
   */
  static create(
    id: string,
    description: string,
    acceptanceCriteria: string[],
    passed: boolean,
    blocked: boolean,
    deprecatedAt?: string,
  ): Deliverable {
    const status: DeliverableStatusValue = passed
      ? 'passed'
      : blocked
        ? 'blocked'
        : 'pending'
    return new Deliverable(
      id,
      description,
      acceptanceCriteria,
      status,
      deprecatedAt,
    )
  }

  /**
   * Create a deliverable in pending state
   */
  static pending(
    id: string,
    description: string,
    acceptanceCriteria: string[],
  ): Deliverable {
    return new Deliverable(id, description, acceptanceCriteria, 'pending')
  }

  /**
   * Create a deliverable in passed state
   */
  static passed(
    id: string,
    description: string,
    acceptanceCriteria: string[],
  ): Deliverable {
    return new Deliverable(id, description, acceptanceCriteria, 'passed')
  }

  /**
   * Create a deliverable in blocked state
   */
  static blocked(
    id: string,
    description: string,
    acceptanceCriteria: string[],
  ): Deliverable {
    return new Deliverable(id, description, acceptanceCriteria, 'blocked')
  }

  /**
   * Transition to passed state
   * @returns New Deliverable instance with status='passed'
   */
  markPassed(): Deliverable {
    return new Deliverable(
      this.id,
      this.description,
      this.acceptanceCriteria as string[],
      'passed',
      this.deprecatedAt,
    )
  }

  /**
   * Transition to blocked state
   * @returns New Deliverable instance with status='blocked'
   */
  markBlocked(): Deliverable {
    return new Deliverable(
      this.id,
      this.description,
      this.acceptanceCriteria as string[],
      'blocked',
      this.deprecatedAt,
    )
  }

  /**
   * Reset to pending state
   * @returns New Deliverable instance with status='pending'
   */
  reset(): Deliverable {
    return new Deliverable(
      this.id,
      this.description,
      this.acceptanceCriteria as string[],
      'pending',
      this.deprecatedAt,
    )
  }

  /**
   * Mark deliverable as deprecated
   * @param date - Optional date string (YYYY-MM-DD). Defaults to current date.
   * @returns New Deliverable instance with deprecatedAt set
   */
  markDeprecated(date?: string): Deliverable {
    const deprecatedAt = date ?? new Date().toISOString().split('T')[0]!
    return new Deliverable(
      this.id,
      this.description,
      this.acceptanceCriteria as string[],
      this._status,
      deprecatedAt,
    )
  }
}
