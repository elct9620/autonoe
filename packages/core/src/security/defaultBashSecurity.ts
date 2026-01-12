/**
 * Default BashSecurity implementation
 * @see SPEC.md Section 6.3
 */

import type {
  PreToolUseHook,
  PreToolUseInput,
  HookResult,
} from '../agentClient'
import type {
  ValidationResult,
  BashSecurity,
  BashSecurityOptions,
  ProfileName,
  ExecutionMode,
  CommandLayer,
} from './types'
import { ALL_PROFILES, isBashSecurity } from './types'
import {
  PROFILE_COMMAND_SETS,
  PROFILE_PKILL_TARGETS,
  VALIDATED_COMMANDS,
  DESTRUCTIVE_COMMANDS,
} from './profiles'
import { splitCommandChain, parseCommand } from './commandParser'
import {
  validateChmod,
  validateDevScript,
  validateRm,
  validateMv,
  validatePkill,
} from './validators'

/**
 * Collect commands from profile command sets based on layer
 */
function collectCommandsFromProfiles(
  profiles: ProfileName[],
  layer: CommandLayer,
  extensions?: string[],
): Set<string> {
  const result = new Set<string>()

  for (const profile of profiles) {
    const commandSet = PROFILE_COMMAND_SETS[profile]
    const commands = commandSet[layer]
    for (const cmd of commands) {
      result.add(cmd)
    }
  }

  if (extensions) {
    for (const cmd of extensions) {
      result.add(cmd)
    }
  }

  return result
}

/**
 * Collect items from profile mappings and optional user extensions
 */
function collectFromProfiles<T>(
  profiles: ProfileName[],
  profileMapping: Record<ProfileName, Set<T>>,
  extensions?: T[],
): Set<T> {
  const result = new Set<T>()

  for (const profile of profiles) {
    const items = profileMapping[profile]
    for (const item of items) {
      result.add(item)
    }
  }

  if (extensions) {
    for (const item of extensions) {
      result.add(item)
    }
  }

  return result
}

/**
 * Create a PreToolUse hook for bash command security
 *
 * @param securityOrOptions - BashSecurity instance or options to create one
 * @returns PreToolUseHook that validates bash commands
 */
export function createBashSecurityHook(
  securityOrOptions?: BashSecurity | BashSecurityOptions,
): PreToolUseHook {
  const security = isBashSecurity(securityOrOptions)
    ? securityOrOptions
    : new DefaultBashSecurity(securityOrOptions ?? {})

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
 * Default implementation of BashSecurity
 */
export class DefaultBashSecurity implements BashSecurity {
  private readonly mode: ExecutionMode
  private readonly allowedCommands: Set<string>
  private readonly allowedPkillTargets: Set<string>
  private readonly allowDestructive: boolean
  private readonly projectDir: string | undefined

  constructor(options: BashSecurityOptions = {}) {
    this.mode = options.mode ?? 'run'
    const profiles = this.resolveActiveProfiles(options.activeProfiles)
    const layer = this.modeToLayer(this.mode)

    // Collect commands based on layer
    // In sync mode, user extensions (allowCommands) are ignored for security
    this.allowedCommands = collectCommandsFromProfiles(
      profiles,
      layer,
      this.mode === 'run' ? options.allowCommands : undefined,
    )

    // pkill targets are always collected (sync mode may need to kill test processes)
    this.allowedPkillTargets = collectFromProfiles(
      profiles,
      PROFILE_PKILL_TARGETS,
      options.allowPkillTargets,
    )

    // Destructive commands are always disabled in sync mode
    this.allowDestructive =
      this.mode === 'run' && (options.allowDestructive ?? false)
    this.projectDir = options.projectDir
  }

  /**
   * Map execution mode to command layer
   */
  private modeToLayer(mode: ExecutionMode): CommandLayer {
    return mode === 'sync' ? 'verification' : 'development'
  }

  /**
   * Resolve active profiles
   * - undefined/empty: ALL profiles
   * - specified: base + specified profiles
   */
  private resolveActiveProfiles(activeProfiles?: ProfileName[]): ProfileName[] {
    if (!activeProfiles || activeProfiles.length === 0) {
      return [...ALL_PROFILES]
    }

    // Always include base profile
    const profiles = new Set<ProfileName>(['base'])
    for (const profile of activeProfiles) {
      profiles.add(profile)
    }
    return [...profiles]
  }

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
    const { base, fullCommand, args } = parseCommand(command)

    if (!base) {
      return { allowed: true }
    }

    // Special handling for bin/dev.sh script execution
    if (fullCommand === './bin/dev.sh' || fullCommand === 'bin/dev.sh') {
      return validateDevScript(args)
    }

    // Handle destructive commands (rm, mv)
    if (DESTRUCTIVE_COMMANDS.has(base)) {
      if (!this.allowDestructive) {
        return {
          allowed: false,
          reason: `Command '${base}' is not in the allowlist`,
        }
      }

      if (!this.projectDir) {
        return {
          allowed: false,
          reason: 'Destructive commands require projectDir to be set',
        }
      }

      if (base === 'rm') {
        return validateRm(args, this.projectDir)
      }
      if (base === 'mv') {
        return validateMv(args, this.projectDir)
      }
    }

    // Check if command requires argument validation
    if (VALIDATED_COMMANDS.has(base)) {
      if (base === 'chmod') {
        return validateChmod(args)
      }
      if (base === 'pkill') {
        return validatePkill(args, this.allowedPkillTargets)
      }
    }

    // Check computed allowlist
    if (this.allowedCommands.has(base)) {
      return { allowed: true }
    }

    // Command not in allowlist
    return {
      allowed: false,
      reason: `Command '${base}' is not in the allowlist`,
    }
  }
}
