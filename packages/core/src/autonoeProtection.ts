/**
 * .autonoe/ directory protection hook
 * @see SPEC.md Section 6.2
 */

import type { PreToolUseHook, PreToolUseInput, HookResult } from './agentClient'

/**
 * Allowed write paths for sync mode
 * @see SPEC.md Section 6.4
 */
export const SYNC_ALLOWED_WRITE_PATHS = ['.autonoe-note.md']

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
 * Create a PreToolUse hook that restricts file writes in sync mode
 *
 * This hook only allows writing to .autonoe-note.md in sync mode.
 * All other file writes/edits are blocked to ensure sync is read-only.
 *
 * @see SPEC.md Section 6.4
 * @returns PreToolUseHook that restricts writes to .autonoe-note.md only
 */
export function createSyncWriteRestrictionHook(): PreToolUseHook {
  return {
    name: 'sync-write-restriction',
    matcher: 'Edit|Write',
    callback: async (input: PreToolUseInput): Promise<HookResult> => {
      const filePath = (input.toolInput.file_path ||
        input.toolInput.filePath) as string | undefined

      if (!filePath) {
        return { continue: true, decision: 'approve' }
      }

      const normalizedPath = filePath.replace(/\\/g, '/')
      const basename = normalizedPath.split('/').pop() ?? ''

      // Only allow .autonoe-note.md
      if (basename === '.autonoe-note.md') {
        return { continue: true, decision: 'approve' }
      }

      return {
        continue: false,
        decision: 'block',
        reason: 'Sync mode only allows writing to .autonoe-note.md',
      }
    },
  }
}

/**
 * Check if a file path targets the protected .autonoe/ directory
 */
function isAutonoeProtectedPath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  return normalizedPath.split('/').includes('.autonoe')
}
