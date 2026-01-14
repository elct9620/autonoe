import { describe, it, expect } from 'vitest'
import { SandboxMode } from '../src/options'
import { SECURITY_BASELINE } from '@autonoe/core'

/**
 * Tests for clientFactory sandbox passthrough logic
 *
 * This tests the ternary logic in run.ts:80-82 and sync.ts:104-106:
 *   sandbox: validatedOptions.sandboxMode.disabled
 *     ? undefined
 *     : config.sandbox
 *
 * @see docs/testing.md ClientFactory Sandbox Passthrough section
 */
describe('ClientFactory Sandbox Passthrough', () => {
  // Helper function that mirrors the logic in run.ts and sync.ts
  function resolveSandbox(
    sandboxMode: SandboxMode,
    config: { sandbox: typeof SECURITY_BASELINE.sandbox },
  ) {
    return sandboxMode.disabled ? undefined : config.sandbox
  }

  describe('run command', () => {
    it('SC-CF001: passes config.sandbox when sandboxMode is enabled', () => {
      const sandboxMode = SandboxMode.enabled()
      const config = { sandbox: SECURITY_BASELINE.sandbox }

      const sandbox = resolveSandbox(sandboxMode, config)

      expect(sandbox).toEqual({
        enabled: true,
        autoAllowBashIfSandboxed: true,
      })
    })

    it('SC-CF002: passes undefined when disabled via CLI', () => {
      const sandboxMode = SandboxMode.disabledByCli()
      const config = { sandbox: SECURITY_BASELINE.sandbox }

      const sandbox = resolveSandbox(sandboxMode, config)

      expect(sandbox).toBeUndefined()
    })

    it('SC-CF003: passes undefined when disabled via env', () => {
      const sandboxMode = SandboxMode.disabledByEnv()
      const config = { sandbox: SECURITY_BASELINE.sandbox }

      const sandbox = resolveSandbox(sandboxMode, config)

      expect(sandbox).toBeUndefined()
    })
  })

  describe('sync command', () => {
    it('SC-CF004: passes config.sandbox when sandboxMode is enabled', () => {
      const sandboxMode = SandboxMode.enabled()
      const config = { sandbox: SECURITY_BASELINE.sandbox }

      const sandbox = resolveSandbox(sandboxMode, config)

      expect(sandbox).toEqual({
        enabled: true,
        autoAllowBashIfSandboxed: true,
      })
    })

    it('SC-CF005: passes undefined when disabled via env', () => {
      const sandboxMode = SandboxMode.disabledByEnv()
      const config = { sandbox: SECURITY_BASELINE.sandbox }

      const sandbox = resolveSandbox(sandboxMode, config)

      expect(sandbox).toBeUndefined()
    })
  })
})
