/**
 * Configuration loading and merging
 * @see SPEC.md Section 5.4
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { McpServer } from './types'
import type {
  AllowCommandsConfig,
  BashSecurityOptions,
  ProfileName,
} from './security'

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  enabled: boolean
  autoAllowBashIfSandboxed: boolean
}

/**
 * Hook configuration
 */
export interface HookConfig {
  PreToolUse: string[]
}

/**
 * Permissions configuration
 */
export interface PermissionsConfig {
  allow: readonly string[]
}

/**
 * Full agent configuration
 */
export interface AgentConfig {
  sandbox: SandboxConfig
  permissions: PermissionsConfig
  allowedTools: readonly string[]
  hooks: HookConfig
  mcpServers: Record<string, McpServer>
  bashSecurity: BashSecurityOptions
}

/**
 * User configuration from agent.json (partial, all fields optional)
 */
export interface UserConfig {
  sandbox?: Partial<SandboxConfig>
  permissions?: { allow?: string[] }
  allowedTools?: string[]
  hooks?: Partial<HookConfig>
  mcpServers?: Record<string, McpServer>
  /**
   * Language profile selection
   * - Single profile: "node"
   * - Multiple profiles: ["node", "python"]
   * - Default (undefined): ALL profiles enabled
   */
  profile?: ProfileName | ProfileName[]
  /**
   * Additional bash commands to allow
   * - string[]: Legacy format, treated as { run: [...] }
   * - { base?, run?, sync? }: Tiered structure
   */
  allowCommands?: AllowCommandsConfig
  /**
   * Additional pkill target processes
   */
  allowPkillTargets?: string[]
}

/**
 * Security baseline - always enforced, cannot be overridden
 * @see SPEC.md Section 5.4, 7.4
 */
export const SECURITY_BASELINE: Readonly<AgentConfig> = Object.freeze({
  sandbox: Object.freeze({
    enabled: true,
    autoAllowBashIfSandboxed: true,
  }),
  permissions: Object.freeze({
    allow: Object.freeze([
      'Read(./**)',
      'Write(./**)',
      'Edit(./**)',
      'Glob(./**)',
      'Grep(./**)',
      'Read(/tmp/**)',
      'Write(/tmp/**)',
      'Edit(/tmp/**)',
      'Glob(/tmp/**)',
      'Grep(/tmp/**)',
      'Bash(*)',
    ]),
  }),
  allowedTools: Object.freeze([
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'Skill',
  ]),
  hooks: Object.freeze({
    PreToolUse: ['bash-security', 'autonoe-protection'],
  }),
  mcpServers: {},
  bashSecurity: Object.freeze({
    // undefined = all profiles enabled by default
    activeProfiles: undefined,
    allowCommands: undefined,
    allowPkillTargets: undefined,
  }),
})

/**
 * Load configuration from project directory
 *
 * Loads user config from .autonoe/agent.json if it exists,
 * then merges with security baseline.
 *
 * @param projectDir - Project directory path
 * @returns Merged configuration with security baseline enforced
 */
export async function loadConfig(projectDir: string): Promise<AgentConfig> {
  const agentJsonPath = join(projectDir, '.autonoe', 'agent.json')

  // Try to load user config
  let userConfig: UserConfig = {}
  if (existsSync(agentJsonPath)) {
    try {
      const content = await readFile(agentJsonPath, 'utf-8')
      userConfig = JSON.parse(content) as UserConfig
    } catch {
      // Ignore parse errors, use defaults
    }
  }

  return mergeConfig(SECURITY_BASELINE, userConfig)
}

/**
 * Normalize profile configuration to array form
 */
function normalizeProfiles(
  profile?: ProfileName | ProfileName[],
): ProfileName[] | undefined {
  if (profile === undefined) {
    return undefined // All profiles enabled
  }
  if (typeof profile === 'string') {
    return [profile]
  }
  return profile
}

/**
 * Resolve MCP servers based on user configuration
 *
 * Rules:
 * - undefined: No MCP servers (default)
 * - {}: No servers (user explicitly disabled all)
 * - { ...servers }: User-defined servers
 */
function resolveMcpServers(
  userMcpServers: Record<string, McpServer> | undefined,
): Record<string, McpServer> {
  // Case 1: Not specified → no MCP servers
  if (userMcpServers === undefined) {
    return {}
  }

  // Case 2: User-defined servers (including empty {} to explicitly disable)
  return { ...userMcpServers }
}

/**
 * Merge user configuration with security baseline
 *
 * Rules:
 * - sandbox: Always use baseline (user attempts to disable are ignored)
 * - permissions.allow: Merge user with baseline
 * - allowedTools: Merge user with baseline
 * - hooks: Merge user hooks, baseline hooks always present
 * - mcpServers: User priority (undefined=built-in, {}=none, {...}=merge with user priority)
 * - bashSecurity: Build from user profile + extensions
 *
 * @param baseline - Security baseline configuration
 * @param user - User configuration (partial)
 * @returns Merged configuration
 */
export function mergeConfig(
  baseline: Readonly<AgentConfig>,
  user: UserConfig,
): AgentConfig {
  // Sandbox: Always use baseline (ignore user override)
  const sandbox: SandboxConfig = {
    enabled: baseline.sandbox.enabled,
    autoAllowBashIfSandboxed: baseline.sandbox.autoAllowBashIfSandboxed,
  }

  // Permissions: Merge (unique values)
  const permissions: PermissionsConfig = {
    allow: [
      ...new Set([
        ...baseline.permissions.allow,
        ...(user.permissions?.allow ?? []),
      ]),
    ],
  }

  // AllowedTools: Merge (unique values)
  const allowedTools = [
    ...new Set([...baseline.allowedTools, ...(user.allowedTools ?? [])]),
  ]

  // Hooks: Merge, baseline hooks always first
  const userHooks = user.hooks?.PreToolUse ?? []
  const filteredUserHooks = userHooks.filter(
    (h) => !baseline.hooks.PreToolUse.includes(h),
  )
  const hooks: HookConfig = {
    PreToolUse: [...baseline.hooks.PreToolUse, ...filteredUserHooks],
  }

  // MCP Servers: User priority
  const mcpServers = resolveMcpServers(user.mcpServers)

  // Bash Security: Build from user profile + extensions
  const bashSecurity: BashSecurityOptions = {
    activeProfiles: normalizeProfiles(user.profile),
    allowCommands: user.allowCommands,
    allowPkillTargets: user.allowPkillTargets,
  }

  return {
    sandbox,
    permissions,
    allowedTools,
    hooks,
    mcpServers,
    bashSecurity,
  }
}
