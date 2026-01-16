import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadConfig,
  mergeConfig,
  SECURITY_BASELINE,
  BUILTIN_MCP_SERVERS,
  PLAYWRIGHT_MCP_TOOLS,
} from '../src/configuration'

describe('Configuration', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `autonoe-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('SC-C001: No agent.json', () => {
    it('uses hardcoded settings when no agent.json exists', async () => {
      const config = await loadConfig(testDir)

      expect(config.sandbox.enabled).toBe(true)
      expect(config.sandbox.autoAllowBashIfSandboxed).toBe(true)
      expect(config.permissions.allow).toContain('Read(./**)')
      expect(config.hooks.PreToolUse).toContain('bash-security')
      expect(config.hooks.PreToolUse).toContain('autonoe-protection')
    })

    it('returns default MCP servers with Microsoft Playwright MCP', async () => {
      const config = await loadConfig(testDir)

      expect(config.mcpServers.playwright).toBeDefined()
      expect(config.mcpServers.playwright!.command).toBe('npx')
      expect(config.mcpServers.playwright!.args).toContain(
        '@playwright/mcp@latest',
      )
      expect(config.mcpServers.playwright!.args).toContain('--headless')
    })

    it('includes Playwright MCP tools in allowedTools', async () => {
      const config = await loadConfig(testDir)

      // Verify all Playwright tools are in allowedTools
      for (const tool of PLAYWRIGHT_MCP_TOOLS) {
        expect(config.allowedTools).toContain(tool)
      }
    })
  })

  describe('SC-C002: MCP servers user priority', () => {
    it('uses built-in servers when mcpServers is undefined', async () => {
      // No agent.json = mcpServers undefined
      const config = await loadConfig(testDir)

      expect(config.mcpServers.playwright).toBeDefined()
      expect(config.mcpServers.playwright).toEqual(
        BUILTIN_MCP_SERVERS.playwright,
      )
    })

    it('disables all servers when mcpServers is empty {}', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          mcpServers: {},
        }),
      )

      const config = await loadConfig(testDir)

      expect(Object.keys(config.mcpServers)).toHaveLength(0)
    })

    it('allows user to override built-in playwright config', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          mcpServers: {
            playwright: {
              command: 'npx',
              args: ['@playwright/mcp@latest'], // No headless flag
            },
          },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.mcpServers.playwright!.command).toBe('npx')
      expect(config.mcpServers.playwright!.args).not.toContain('--headless')
    })

    it('merges user servers with built-in when adding new servers', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          mcpServers: {
            'custom-tool': {
              command: 'npx',
              args: ['custom-mcp-server'],
            },
          },
        }),
      )

      const config = await loadConfig(testDir)

      // Built-in playwright still present
      expect(config.mcpServers.playwright).toBeDefined()
      expect(config.mcpServers.playwright).toEqual(
        BUILTIN_MCP_SERVERS.playwright,
      )
      // Custom tool added
      expect(config.mcpServers['custom-tool']).toBeDefined()
      expect(config.mcpServers['custom-tool']!.command).toBe('npx')
    })

    it('user playwright takes precedence over built-in', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        mcpServers: {
          playwright: { command: 'custom', args: ['custom-playwright'] },
        },
      })

      expect(result.mcpServers.playwright!.command).toBe('custom')
      expect(result.mcpServers.playwright!.args).toContain('custom-playwright')
    })
  })

  describe('SC-C003: Custom permissions', () => {
    it('merges user permissions with security baseline', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          permissions: { allow: ['./docs/**', './scripts/**'] },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.permissions.allow).toContain('Read(./**)')
      expect(config.permissions.allow).toContain('./docs/**')
      expect(config.permissions.allow).toContain('./scripts/**')
    })

    it('allows extending permissions', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        permissions: { allow: ['./extra/**'] },
      })

      expect(result.permissions.allow).toContain('Read(./**)')
      expect(result.permissions.allow).toContain('./extra/**')
    })

    it('deduplicates permissions', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        permissions: { allow: ['Read(./**)', './new/**'] },
      })

      const occurrences = result.permissions.allow.filter(
        (p) => p === 'Read(./**)',
      ).length
      expect(occurrences).toBe(1)
    })
  })

  describe('SC-C004: Custom hooks', () => {
    it('merges user hooks with security baseline hooks', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          hooks: {
            PreToolUse: ['custom-validator'],
          },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.hooks.PreToolUse).toContain('bash-security')
      expect(config.hooks.PreToolUse).toContain('autonoe-protection')
      expect(config.hooks.PreToolUse).toContain('custom-validator')
    })

    it('allows adding custom PreToolUse hooks', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        hooks: { PreToolUse: ['my-hook'] },
      })

      expect(result.hooks.PreToolUse).toContain('my-hook')
    })

    it('baseline hooks come first', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        hooks: { PreToolUse: ['custom-hook'] },
      })

      const bashSecurityIndex = result.hooks.PreToolUse.indexOf('bash-security')
      const customHookIndex = result.hooks.PreToolUse.indexOf('custom-hook')

      expect(bashSecurityIndex).toBeLessThan(customHookIndex)
    })

    it('does not duplicate baseline hooks', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        hooks: { PreToolUse: ['bash-security', 'custom-hook'] },
      })

      const occurrences = result.hooks.PreToolUse.filter(
        (h) => h === 'bash-security',
      ).length
      expect(occurrences).toBe(1)
    })
  })

  describe('SC-C005: Sandbox override attempt', () => {
    it('ignores user attempt to disable sandbox', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          sandbox: { enabled: false },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.sandbox.enabled).toBe(true)
    })

    it('ignores user attempt to disable autoAllowBashIfSandboxed', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          sandbox: { autoAllowBashIfSandboxed: false },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.sandbox.autoAllowBashIfSandboxed).toBe(true)
    })
  })

  describe('SC-C006: Protection removal attempt', () => {
    it('re-applies security baseline when protection removed', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          hooks: {
            PreToolUse: [], // Empty - trying to remove all hooks
          },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.hooks.PreToolUse).toContain('bash-security')
      expect(config.hooks.PreToolUse).toContain('autonoe-protection')
    })

    it('maintains BashSecurity hook', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        hooks: { PreToolUse: [] },
      })

      expect(result.hooks.PreToolUse).toContain('bash-security')
    })

    it('maintains .autonoe protection', async () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        hooks: { PreToolUse: [] },
      })

      expect(result.hooks.PreToolUse).toContain('autonoe-protection')
    })
  })

  describe('SC-C009: Temp directory permissions', () => {
    it('includes /tmp read permission in security baseline', async () => {
      const config = await loadConfig(testDir)
      expect(config.permissions.allow).toContain('Read(/tmp/**)')
    })

    it('includes /tmp write permission in security baseline', async () => {
      const config = await loadConfig(testDir)
      expect(config.permissions.allow).toContain('Write(/tmp/**)')
    })

    it('includes /tmp edit permission in security baseline', async () => {
      const config = await loadConfig(testDir)
      expect(config.permissions.allow).toContain('Edit(/tmp/**)')
    })

    it('includes /tmp glob permission in security baseline', async () => {
      const config = await loadConfig(testDir)
      expect(config.permissions.allow).toContain('Glob(/tmp/**)')
    })

    it('includes /tmp grep permission in security baseline', async () => {
      const config = await loadConfig(testDir)
      expect(config.permissions.allow).toContain('Grep(/tmp/**)')
    })

    it('SECURITY_BASELINE has all /tmp permissions', () => {
      expect(SECURITY_BASELINE.permissions.allow).toContain('Read(/tmp/**)')
      expect(SECURITY_BASELINE.permissions.allow).toContain('Write(/tmp/**)')
      expect(SECURITY_BASELINE.permissions.allow).toContain('Edit(/tmp/**)')
      expect(SECURITY_BASELINE.permissions.allow).toContain('Glob(/tmp/**)')
      expect(SECURITY_BASELINE.permissions.allow).toContain('Grep(/tmp/**)')
    })
  })

  describe('SC-C007: Verify sandbox configuration', () => {
    it('sandbox enabled is always true', async () => {
      const config = await loadConfig(testDir)
      expect(config.sandbox.enabled).toBe(true)
    })

    it('autoAllowBashIfSandboxed is always true', async () => {
      const config = await loadConfig(testDir)
      expect(config.sandbox.autoAllowBashIfSandboxed).toBe(true)
    })

    it('SECURITY_BASELINE has correct sandbox values', () => {
      expect(SECURITY_BASELINE.sandbox.enabled).toBe(true)
      expect(SECURITY_BASELINE.sandbox.autoAllowBashIfSandboxed).toBe(true)
    })

    it('cannot modify SECURITY_BASELINE sandbox', () => {
      expect(() => {
        // Testing runtime immutability - Object.freeze prevents modification
        ;(SECURITY_BASELINE.sandbox as { enabled: boolean }).enabled = false
      }).toThrow()
    })
  })

  describe('SC-C008: Profile array normalization', () => {
    it('passes array profile through unchanged', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          profile: ['node', 'python'],
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.bashSecurity.activeProfiles).toEqual(['node', 'python'])
    })

    it('normalizes single profile string to array', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          profile: 'node',
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.bashSecurity.activeProfiles).toEqual(['node'])
    })

    it('uses all profiles when profile is undefined', async () => {
      // No profile specified in agent.json
      const config = await loadConfig(testDir)

      expect(config.bashSecurity.activeProfiles).toBeUndefined()
    })

    it('mergeConfig handles array profile correctly', () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        profile: ['node', 'python'],
      })

      expect(result.bashSecurity.activeProfiles).toEqual(['node', 'python'])
    })

    it('mergeConfig handles string profile correctly', () => {
      const result = mergeConfig(SECURITY_BASELINE, {
        profile: 'node',
      })

      expect(result.bashSecurity.activeProfiles).toEqual(['node'])
    })
  })

  describe('Configuration loading', () => {
    it('loads agent.json from .autonoe directory', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          permissions: { allow: ['./custom/**'] },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.permissions.allow).toContain('./custom/**')
    })

    it('handles malformed agent.json gracefully', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(join(testDir, '.autonoe', 'agent.json'), '{ invalid json }')

      const config = await loadConfig(testDir)

      // Should fall back to defaults
      expect(config.sandbox.enabled).toBe(true)
      expect(config.hooks.PreToolUse).toContain('bash-security')
    })

    it('handles missing .autonoe directory', async () => {
      const config = await loadConfig(testDir)

      expect(config.sandbox.enabled).toBe(true)
      expect(config.permissions.allow).toContain('Read(./**)')
    })
  })
})
