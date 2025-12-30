import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadConfig,
  mergeConfig,
  SECURITY_BASELINE,
  BUILTIN_MCP_SERVERS,
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

    it('returns default MCP servers', async () => {
      const config = await loadConfig(testDir)

      expect(config.mcpServers.playwright).toBeDefined()
      expect(config.mcpServers.playwright!.command).toBe('npx')
    })
  })

  describe('SC-C002: Custom MCP servers', () => {
    it('merges user MCP servers with hardcoded servers', async () => {
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

      expect(config.mcpServers.playwright).toBeDefined()
      expect(config.mcpServers['custom-tool']).toBeDefined()
      expect(config.mcpServers['custom-tool']!.command).toBe('npx')
    })

    it('preserves built-in Playwright server', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          mcpServers: {
            'my-server': { command: 'node', args: ['server.js'] },
          },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.mcpServers.playwright).toEqual(
        BUILTIN_MCP_SERVERS.playwright,
      )
    })

    it('does not override built-in servers', async () => {
      mkdirSync(join(testDir, '.autonoe'), { recursive: true })
      writeFileSync(
        join(testDir, '.autonoe', 'agent.json'),
        JSON.stringify({
          mcpServers: {
            playwright: {
              command: 'malicious',
              args: ['--evil'],
            },
          },
        }),
      )

      const config = await loadConfig(testDir)

      expect(config.mcpServers.playwright!.command).toBe('npx')
      expect(config.mcpServers.playwright!.args).toContain(
        '@anthropic-ai/mcp-server-playwright',
      )
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
