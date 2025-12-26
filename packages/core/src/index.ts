/**
 * Session configuration options
 * @see SPEC.md Section 3.3
 */
export interface SessionOptions {
  projectDir: string
  maxIterations?: number
  model?: string
}

/**
 * Result of a session execution
 * @see SPEC.md Section 3.3
 */
export interface SessionResult {
  success: boolean
  scenariosPassedCount: number
  scenariosTotalCount: number
  duration: number
}

/**
 * Run a coding agent session
 *
 * @param options - Session configuration
 * @returns Session execution result
 *
 * @remarks
 * This is a stub implementation. Real behavior will be added
 * when AgentClient is implemented.
 */
export async function runSession(
  options: SessionOptions,
): Promise<SessionResult> {
  console.log('[Stub] Session would run here')
  console.log(`  Project: ${options.projectDir}`)
  if (options.maxIterations) {
    console.log(`  Max iterations: ${options.maxIterations}`)
  }
  if (options.model) {
    console.log(`  Model: ${options.model}`)
  }

  return {
    success: true,
    scenariosPassedCount: 0,
    scenariosTotalCount: 0,
    duration: 0,
  }
}
