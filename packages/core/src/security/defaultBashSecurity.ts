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
  AllowCommandsConfig,
  TieredAllowCommands,
} from './types'
import { ALL_PROFILES, isBashSecurity } from './types'
import {
  PROFILE_COMMANDS,
  PROFILE_PKILL_TARGETS,
  VALIDATED_COMMANDS,
  DESTRUCTIVE_COMMANDS,
  BASE_READONLY_COMMANDS,
  RUN_EXTENSION_COMMANDS,
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
 * Normalize allow commands to tiered structure
 * - undefined -> {}
 * - string[] -> { run: [...] } (legacy format, backward compatible)
 * - TieredAllowCommands -> as-is
 */
function normalizeAllowCommands(
  config: AllowCommandsConfig | undefined,
): TieredAllowCommands {
  if (!config) {
    return {}
  }

  // Legacy format: string[] treated as run-only commands
  if (Array.isArray(config)) {
    return { run: config }
  }

  // Already tiered format
  return config
}

/**
 * Get allow commands for the given execution mode
 * Returns base + mode-specific commands
 */
function getAllowCommandsForMode(
  tiered: TieredAllowCommands,
  mode: ExecutionMode,
): string[] {
  const base = tiered.base ?? []
  const modeSpecific = mode === 'run' ? (tiered.run ?? []) : (tiered.sync ?? [])
  return [...base, ...modeSpecific]
}

/**
 * Collect commands for active profiles
 * - Base readonly commands (always)
 * - Run extension commands (run mode only)
 * - Language profile commands (same for all modes)
 */
function collectCommands(
  profiles: ProfileName[],
  mode: ExecutionMode,
  extensions?: string[],
): Set<string> {
  const result = new Set<string>()

  // 1. Base readonly commands (always available)
  for (const cmd of BASE_READONLY_COMMANDS) {
    result.add(cmd)
  }

  // 2. Run extension commands (mkdir, cp) - run mode only
  if (mode === 'run') {
    for (const cmd of RUN_EXTENSION_COMMANDS) {
      result.add(cmd)
    }
  }

  // 3. Language profile commands (same for all modes)
  for (const profile of profiles) {
    if (profile === 'base') continue // handled above
    const commands = PROFILE_COMMANDS[profile]
    for (const cmd of commands) {
      result.add(cmd)
    }
  }

  // 4. User extensions
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

    // Normalize and get mode-specific allow commands
    const tieredCommands = normalizeAllowCommands(options.allowCommands)
    const extensions = getAllowCommandsForMode(tieredCommands, this.mode)

    // Collect commands with mode-specific extensions
    this.allowedCommands = collectCommands(
      profiles,
      this.mode,
      extensions.length > 0 ? extensions : undefined,
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
