import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validatePathWithinProject } from '../src/security/validators'

// Mock node:fs module
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return {
    ...original,
    existsSync: vi.fn(),
    realpathSync: vi.fn(),
  }
})

import { existsSync, realpathSync } from 'node:fs'

describe('validators', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validatePathWithinProject', () => {
    describe('SC-X060: Symlink resolution error', () => {
      it('returns blocked when realpathSync throws exception', () => {
        // Path exists
        vi.mocked(existsSync).mockReturnValue(true)
        // But realpathSync throws (e.g., permission denied, I/O error)
        vi.mocked(realpathSync).mockImplementation(() => {
          throw new Error('Permission denied')
        })

        const result = validatePathWithinProject('./test-file', '/project')

        expect(result.allowed).toBe(false)
        expect(result.reason).toBe('Symlink target escapes project directory')
      })

      it('handles various error types from realpathSync', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(realpathSync).mockImplementation(() => {
          const err = new Error('EACCES') as NodeJS.ErrnoException
          err.code = 'EACCES'
          throw err
        })

        const result = validatePathWithinProject('./secret-file', '/project')

        expect(result.allowed).toBe(false)
        expect(result.reason).toBe('Symlink target escapes project directory')
      })
    })

    describe('Path validation', () => {
      it('allows path within project when realpathSync succeeds', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(realpathSync).mockReturnValue('/project/test-file')

        const result = validatePathWithinProject('./test-file', '/project')

        expect(result.allowed).toBe(true)
      })

      it('blocks path outside project', () => {
        vi.mocked(existsSync).mockReturnValue(true)
        vi.mocked(realpathSync).mockReturnValue('/outside/test-file')

        const result = validatePathWithinProject(
          '../outside/test-file',
          '/project',
        )

        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('escapes project directory')
      })

      it('uses resolved path when file does not exist', () => {
        vi.mocked(existsSync).mockReturnValue(false)

        const result = validatePathWithinProject('./new-file', '/project')

        expect(result.allowed).toBe(true)
        // realpathSync should not be called for non-existent paths
        expect(realpathSync).not.toHaveBeenCalled()
      })
    })
  })
})
