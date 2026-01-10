/**
 * Command validators
 */

import { resolve, normalize } from 'node:path'
import { realpathSync, existsSync } from 'node:fs'
import type { ValidationResult } from './types'
import { CHMOD_ALLOWED_MODE_PATTERN, BLOCKED_RM_FLAGS } from './profiles'

/**
 * Validate chmod command arguments
 * - Allows: +x, u+x, g+x, o+x, a+x, ug+x, etc.
 * - Blocks: -R (recursive), numeric modes (755, 777)
 */
export function validateChmod(args: string[]): ValidationResult {
  if (args.length < 2) {
    return { allowed: false, reason: 'chmod requires mode and target file(s)' }
  }

  // Check for -R flag anywhere in args
  if (args.some((arg) => arg === '-R' || arg.startsWith('-R'))) {
    return { allowed: false, reason: 'chmod -R (recursive) is not allowed' }
  }

  const mode = args[0]!

  // Block numeric modes (e.g., 755, 777)
  if (/^\d+$/.test(mode)) {
    return { allowed: false, reason: 'chmod numeric modes are not allowed' }
  }

  // Only allow +x variants
  if (!CHMOD_ALLOWED_MODE_PATTERN.test(mode)) {
    return {
      allowed: false,
      reason: `chmod mode '${mode}' is not allowed, only +x variants permitted`,
    }
  }

  return { allowed: true }
}

/**
 * Validate bin/dev.sh script execution
 * - Allows: ./bin/dev.sh, bin/dev.sh (without arguments)
 * - Blocks: Any arguments (prevent injection)
 */
export function validateDevScript(args: string[]): ValidationResult {
  if (args.length > 0) {
    return {
      allowed: false,
      reason: 'bin/dev.sh does not accept arguments',
    }
  }
  return { allowed: true }
}

/**
 * Validate that a path is within the project directory
 * @see SPEC.md Section 6.4.3
 *
 * Steps:
 * 1. Resolve against projectDir
 * 2. Resolve symlinks with fs.realpathSync()
 * 3. Normalize path (remove . and ..)
 * 4. Verify starts with projectDir
 */
export function validatePathWithinProject(
  inputPath: string,
  projectDir: string,
): ValidationResult {
  // Step 1: Resolve against projectDir
  const resolved = resolve(projectDir, inputPath)

  // Step 2: Resolve symlinks (only if path exists)
  let realPath: string
  if (existsSync(resolved)) {
    try {
      realPath = realpathSync(resolved)
    } catch {
      // If symlink resolution fails, treat as escape
      return {
        allowed: false,
        reason: 'Symlink target escapes project directory',
      }
    }
  } else {
    // For non-existent paths, just use resolved
    realPath = resolved
  }

  // Step 3: Normalize (remove . and ..)
  const normalizedPath = normalize(realPath)
  const normalizedProjectDir = normalize(projectDir)

  // Step 4: Verify starts with projectDir
  if (
    !normalizedPath.startsWith(normalizedProjectDir + '/') &&
    normalizedPath !== normalizedProjectDir
  ) {
    return {
      allowed: false,
      reason: `Path '${inputPath}' escapes project directory`,
    }
  }

  return { allowed: true }
}

/**
 * Validate rm command arguments
 * - Checks for blocked flags (--no-preserve-root)
 * - Validates all paths are within project directory
 * @see SPEC.md Section 6.4
 */
export function validateRm(
  args: string[],
  projectDir: string,
): ValidationResult {
  // Check for blocked flags
  for (const arg of args) {
    if (BLOCKED_RM_FLAGS.has(arg)) {
      return {
        allowed: false,
        reason: `Flag '${arg}' is not allowed with rm`,
      }
    }
  }

  // Extract paths (skip flags starting with -)
  const paths = args.filter((arg) => !arg.startsWith('-'))

  if (paths.length === 0) {
    return { allowed: false, reason: 'rm requires at least one file path' }
  }

  // Validate each path is within project
  for (const path of paths) {
    const result = validatePathWithinProject(path, projectDir)
    if (!result.allowed) {
      return result
    }
  }

  return { allowed: true }
}

/**
 * Validate mv command arguments
 * - Validates both source and destination paths are within project directory
 * @see SPEC.md Section 6.4
 */
export function validateMv(
  args: string[],
  projectDir: string,
): ValidationResult {
  // Extract paths (skip flags starting with -)
  const paths = args.filter((arg) => !arg.startsWith('-'))

  if (paths.length < 2) {
    return {
      allowed: false,
      reason: 'mv requires source and destination paths',
    }
  }

  // Validate each path is within project
  for (const path of paths) {
    const result = validatePathWithinProject(path, projectDir)
    if (!result.allowed) {
      return result
    }
  }

  return { allowed: true }
}

/**
 * Validate pkill command arguments with allowed targets
 */
export function validatePkill(
  args: string[],
  allowedTargets: Set<string>,
): ValidationResult {
  if (args.length === 0) {
    return { allowed: false, reason: 'pkill requires a process name' }
  }

  // Find the process name (skip flags like -f, -9)
  const processName = args.find((arg) => !arg.startsWith('-'))

  if (!processName) {
    return { allowed: false, reason: 'pkill requires a process name' }
  }

  if (!allowedTargets.has(processName)) {
    return {
      allowed: false,
      reason: `pkill target '${processName}' is not allowed, only dev processes permitted`,
    }
  }

  return { allowed: true }
}
