/**
 * Configuration loading and merging
 * @see SPEC.md Section 5.4
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { McpServer } from './types'

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
 * Full agent configuration
 */
export interface AgentConfig {
  sandbox: SandboxConfig
  permissions: string[]
  hooks: HookConfig
  mcpServers: Record<string, McpServer>
}

/**
 * User configuration from agent.json (partial, all fields optional)
 */
export interface UserConfig {
  sandbox?: Partial<SandboxConfig>
  permissions?: string[]
  hooks?: Partial<HookConfig>
  mcpServers?: Record<string, McpServer>
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
  permissions: ['./**'],
  hooks: Object.freeze({
    PreToolUse: ['bash-security', 'autonoe-protection'],
  }),
  mcpServers: {},
})

/**
 * Built-in MCP servers (hardcoded)
 */
export const BUILTIN_MCP_SERVERS: Readonly<Record<string, McpServer>> =
  Object.freeze({
    playwright: Object.freeze({
      command: 'npx',
      args: ['@anthropic-ai/mcp-server-playwright'],
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
 * Merge user configuration with security baseline
 *
 * Rules:
 * - sandbox: Always use baseline (user attempts to disable are ignored)
 * - permissions: Merge user permissions with baseline
 * - hooks: Merge user hooks, baseline hooks always present
 * - mcpServers: Merge built-in and user servers
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
  const permissions = [
    ...new Set([...baseline.permissions, ...(user.permissions ?? [])]),
  ]

  // Hooks: Merge, baseline hooks always first
  const userHooks = user.hooks?.PreToolUse ?? []
  const filteredUserHooks = userHooks.filter(
    (h) => !baseline.hooks.PreToolUse.includes(h),
  )
  const hooks: HookConfig = {
    PreToolUse: [...baseline.hooks.PreToolUse, ...filteredUserHooks],
  }

  // MCP Servers: Merge built-in and user (built-in cannot be overridden)
  const mcpServers: Record<string, McpServer> = {
    ...BUILTIN_MCP_SERVERS,
    ...Object.fromEntries(
      Object.entries(user.mcpServers ?? {}).filter(
        ([name]) => !(name in BUILTIN_MCP_SERVERS),
      ),
    ),
  }

  return {
    sandbox,
    permissions,
    hooks,
    mcpServers,
  }
}
