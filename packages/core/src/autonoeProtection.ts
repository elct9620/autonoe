/**
 * .autonoe/ directory protection hook
 * @see SPEC.md Section 6.2
 */

import type { PreToolUseHook, PreToolUseInput, HookResult } from './agentClient'

/**
 * Create a PreToolUse hook that protects the .autonoe/ directory from direct writes
 *
 * This hook blocks direct file writes/edits to the .autonoe/ directory.
 * Writes should only be done via the StatusTool.
 *
 * @returns PreToolUseHook that blocks direct writes to .autonoe/
 */
export function createAutonoeProtectionHook(): PreToolUseHook {
  return {
    name: 'autonoe-protection',
    matcher: 'Edit|Write',
    callback: async (input: PreToolUseInput): Promise<HookResult> => {
      // Check for file_path in tool input (handles both Edit and Write tools)
      const filePath = (input.toolInput.file_path ||
        input.toolInput.filePath) as string | undefined

      if (!filePath) {
        return { continue: true, decision: 'approve' }
      }

      // Check if the path targets .autonoe/ directory
      if (isAutonoeProtectedPath(filePath)) {
        return {
          continue: false,
          decision: 'block',
          reason:
            'Direct writes to .autonoe/ directory are not allowed. Use StatusTool instead.',
        }
      }

      return { continue: true, decision: 'approve' }
    },
  }
}

/**
 * Check if a file path targets the protected .autonoe/ directory
 */
function isAutonoeProtectedPath(filePath: string): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/')

  // Check various patterns that indicate .autonoe/ directory
  return (
    normalizedPath.includes('.autonoe/') ||
    normalizedPath.endsWith('/.autonoe') ||
    normalizedPath.startsWith('.autonoe/') ||
    normalizedPath === '.autonoe'
  )
}
