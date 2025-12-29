import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as childProcess from 'child_process'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

describe('detectClaudeCodePath', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    vi.resetModules()
    vi.mocked(childProcess.execSync).mockReset()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  describe('Unix platform', () => {
    it('SC-AC013: returns path when claude is found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      vi.mocked(childProcess.execSync).mockReturnValue(
        '/usr/local/bin/claude\n',
      )

      const { detectClaudeCodePath } = await import('../src/claudeCodePath')
      const result = detectClaudeCodePath()

      expect(childProcess.execSync).toHaveBeenCalledWith('which claude', {
        encoding: 'utf-8',
      })
      expect(result).toBe('/usr/local/bin/claude')
    })

    it('SC-AC014: returns undefined when claude is not found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error('not found')
      })

      const { detectClaudeCodePath } = await import('../src/claudeCodePath')
      const result = detectClaudeCodePath()

      expect(result).toBeUndefined()
    })
  })

  describe('Windows platform', () => {
    it('uses "where" command on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
      vi.mocked(childProcess.execSync).mockReturnValue(
        'C:\\Program Files\\claude.exe\n',
      )

      const { detectClaudeCodePath } = await import('../src/claudeCodePath')
      const result = detectClaudeCodePath()

      expect(childProcess.execSync).toHaveBeenCalledWith('where claude', {
        encoding: 'utf-8',
      })
      expect(result).toBe('C:\\Program Files\\claude.exe')
    })

    it('returns first path when multiple paths returned', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })
      vi.mocked(childProcess.execSync).mockReturnValue(
        'C:\\Users\\path1\\claude.exe\nC:\\Users\\path2\\claude.exe\n',
      )

      const { detectClaudeCodePath } = await import('../src/claudeCodePath')
      const result = detectClaudeCodePath()

      expect(result).toBe('C:\\Users\\path1\\claude.exe')
    })
  })

  it('returns undefined for empty result', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    vi.mocked(childProcess.execSync).mockReturnValue('\n')

    const { detectClaudeCodePath } = await import('../src/claudeCodePath')
    const result = detectClaudeCodePath()

    expect(result).toBeUndefined()
  })
})
