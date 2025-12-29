/**
 * Bash command security validation
 * @see SPEC.md Section 6.3
 */

import type { PreToolUseHook, PreToolUseInput, HookResult } from './agentClient'

export interface ValidationResult {
  allowed: boolean
  reason?: string
}

export interface BashSecurity {
  isCommandAllowed(command: string): ValidationResult
}

type CommandValidator = (args: string[]) => ValidationResult

/**
 * Create a PreToolUse hook for bash command security
 *
 * @param security - BashSecurity instance to use for validation
 * @returns PreToolUseHook that validates bash commands
 */
export function createBashSecurityHook(
  security: BashSecurity = new DefaultBashSecurity(),
): PreToolUseHook {
  return {
    name: 'bash-security',
    matcher: 'Bash',
    callback: async (input: PreToolUseInput): Promise<HookResult> => {
      const command = input.toolInput.command as string | undefined

      if (!command) {
        return { continue: true, decision: 'approve' }
      }

      const result = security.isCommandAllowed(command)

      if (result.allowed) {
        return { continue: true, decision: 'approve' }
      }

      return {
        continue: false,
        decision: 'block',
        reason: result.reason ?? 'Command not allowed',
      }
    },
  }
}

/**
 * Commands allowed without argument validation
 */
const SIMPLE_ALLOWLIST = new Set([
  // Navigation
  'ls',
  'pwd',
  'cat',
  'head',
  'tail',
  'wc',
  'find',
  'grep',
  // File Ops
  'mkdir',
  'cp',
  // Git
  'git',
  // Node.js
  'node',
  'npm',
  'npx',
  // Build
  'tsc',
  'esbuild',
  'vite',
  // Test
  'jest',
  'vitest',
  'playwright',
  // Process
  'echo',
  'which',
  'ps',
  'lsof',
  'sleep',
])

/**
 * Commands requiring argument validation
 */
const VALIDATED_COMMANDS: Record<string, CommandValidator> = {
  chmod: validateChmod,
  pkill: validatePkill,
}

/**
 * Allowed pkill targets (dev-related processes only)
 */
const ALLOWED_PKILL_TARGETS = new Set(['node', 'npm', 'npx', 'vite', 'next'])

/**
 * Pattern for allowed chmod modes (+x variants)
 */
const CHMOD_ALLOWED_MODE_PATTERN = /^[ugoa]*\+x$/

/**
 * Validate chmod command arguments
 * - Allows: +x, u+x, g+x, o+x, a+x, ug+x, etc.
 * - Blocks: -R (recursive), numeric modes (755, 777)
 */
function validateChmod(args: string[]): ValidationResult {
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
 * Validate pkill command arguments
 * - Only allows dev-related process names: node, npm, npx, vite, next
 */
function validatePkill(args: string[]): ValidationResult {
  if (args.length === 0) {
    return { allowed: false, reason: 'pkill requires a process name' }
  }

  // Find the process name (skip flags like -f, -9)
  const processName = args.find((arg) => !arg.startsWith('-'))

  if (!processName) {
    return { allowed: false, reason: 'pkill requires a process name' }
  }

  if (!ALLOWED_PKILL_TARGETS.has(processName)) {
    return {
      allowed: false,
      reason: `pkill target '${processName}' is not allowed, only dev processes permitted`,
    }
  }

  return { allowed: true }
}

/**
 * Split command string into individual commands by chain operators
 * Handles: &&, ||, |, ;
 */
function splitCommandChain(command: string): string[] {
  const commands: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    const nextChar = command[i + 1]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      current += char
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      current += char
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      current += char
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      // Check for operators
      if (char === ';') {
        if (current.trim()) commands.push(current.trim())
        current = ''
        continue
      }

      if (char === '|') {
        if (nextChar === '|') {
          // ||
          if (current.trim()) commands.push(current.trim())
          current = ''
          i++ // skip next |
          continue
        } else {
          // single pipe
          if (current.trim()) commands.push(current.trim())
          current = ''
          continue
        }
      }

      if (char === '&' && nextChar === '&') {
        if (current.trim()) commands.push(current.trim())
        current = ''
        i++ // skip next &
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    commands.push(current.trim())
  }

  return commands
}

/**
 * Parse a single command into base command and arguments
 */
function parseCommand(command: string): { base: string; args: string[] } {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  if (tokens.length === 0) {
    return { base: '', args: [] }
  }

  // Extract base command name (handle paths like /usr/bin/git)
  const fullCommand = tokens[0]!
  const base = fullCommand.includes('/')
    ? (fullCommand.split('/').pop() ?? fullCommand)
    : fullCommand

  return { base, args: tokens.slice(1) }
}

/**
 * Default implementation of BashSecurity
 */
export class DefaultBashSecurity implements BashSecurity {
  isCommandAllowed(command: string): ValidationResult {
    // Handle empty command
    if (!command || !command.trim()) {
      return { allowed: true }
    }

    // Split into individual commands
    const commands = splitCommandChain(command)

    // If any command in the chain is blocked, entire chain is denied
    for (const cmd of commands) {
      const result = this.validateSingleCommand(cmd)
      if (!result.allowed) {
        return result
      }
    }

    return { allowed: true }
  }

  private validateSingleCommand(command: string): ValidationResult {
    const { base, args } = parseCommand(command)

    if (!base) {
      return { allowed: true }
    }

    // Check if command requires argument validation
    const validator = VALIDATED_COMMANDS[base]
    if (validator) {
      return validator(args)
    }

    // Check simple allowlist
    if (SIMPLE_ALLOWLIST.has(base)) {
      return { allowed: true }
    }

    // Command not in allowlist
    return {
      allowed: false,
      reason: `Command '${base}' is not in the allowlist`,
    }
  }
}
