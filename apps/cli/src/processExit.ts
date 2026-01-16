/**
 * Strategy interface for process exit
 * Allows dependency injection for testability
 */
export interface ProcessExitStrategy {
  exit(code: number): never
}

/**
 * Default implementation that calls process.exit()
 */
export const defaultProcessExit: ProcessExitStrategy = {
  exit: (code: number): never => process.exit(code) as never,
}
