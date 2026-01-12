import { describe, it, expect } from 'vitest'
import {
  createAutonoeProtectionHook,
  createSyncWriteRestrictionHook,
  SYNC_ALLOWED_WRITE_PATHS,
} from '../src/autonoeProtection'

describe('Autonoe Protection', () => {
  describe('SC-AP001: Block .autonoe/status.json', () => {
    it('blocks direct write to .autonoe/status.json', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: '.autonoe/status.json' },
      })

      expect(result.decision).toBe('block')
      expect(result.continue).toBe(false)
      expect(result.reason).toContain('.autonoe/')
    })
  })

  describe('SC-AP002: Approve normal files', () => {
    it('approves write to src/index.ts', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: 'src/index.ts' },
      })

      expect(result.decision).toBe('approve')
      expect(result.continue).toBe(true)
    })

    it('approves write to ./normal/path/file.ts', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { file_path: './normal/path/file.ts' },
      })

      expect(result.decision).toBe('approve')
      expect(result.continue).toBe(true)
    })
  })

  describe('SC-AP003: Block absolute path with .autonoe', () => {
    it('blocks /abs/.autonoe/file', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: '/abs/.autonoe/file' },
      })

      expect(result.decision).toBe('block')
      expect(result.continue).toBe(false)
    })

    it('blocks /home/user/project/.autonoe/status.json', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { file_path: '/home/user/project/.autonoe/status.json' },
      })

      expect(result.decision).toBe('block')
    })
  })

  describe('SC-AP004: Block relative path with .autonoe', () => {
    it('blocks ./project/.autonoe/x', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: './project/.autonoe/x' },
      })

      expect(result.decision).toBe('block')
      expect(result.continue).toBe(false)
    })
  })

  describe('SC-AP005: Approve undefined file_path', () => {
    it('approves when file_path is undefined', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: {},
      })

      expect(result.decision).toBe('approve')
      expect(result.continue).toBe(true)
    })

    it('approves when toolInput is empty', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: {},
      })

      expect(result.decision).toBe('approve')
    })
  })

  describe('SC-AP006: Handle filePath (camelCase)', () => {
    it('blocks .autonoe/x with camelCase filePath', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { filePath: '.autonoe/agent.json' },
      })

      expect(result.decision).toBe('block')
      expect(result.continue).toBe(false)
    })

    it('approves normal path with camelCase filePath', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { filePath: 'src/app.ts' },
      })

      expect(result.decision).toBe('approve')
    })
  })

  describe('SC-AP007: Handle Windows paths', () => {
    it('blocks Windows path with .autonoe\\file', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: '.autonoe\\status.json' },
      })

      expect(result.decision).toBe('block')
      expect(result.continue).toBe(false)
    })

    it('blocks Windows absolute path C:\\.autonoe\\file', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { file_path: 'C:\\project\\.autonoe\\config.json' },
      })

      expect(result.decision).toBe('block')
    })
  })

  describe('Hook properties', () => {
    it('has correct name', () => {
      const hook = createAutonoeProtectionHook()
      expect(hook.name).toBe('autonoe-protection')
    })

    it('has correct matcher for Edit|Write', () => {
      const hook = createAutonoeProtectionHook()
      expect(hook.matcher).toBe('Edit|Write')
    })
  })

  describe('SC-AP008: Approve .autonoe-note.md', () => {
    it('approves .autonoe-note.md (hyphenated filename at root)', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: '/workspace/.autonoe-note.md' },
      })

      expect(result.decision).toBe('approve')
    })

    it('approves relative .autonoe-note.md', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: '.autonoe-note.md' },
      })

      expect(result.decision).toBe('approve')
    })
  })

  describe('Edge cases', () => {
    it('blocks .autonoe without trailing slash', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: '.autonoe' },
      })

      expect(result.decision).toBe('block')
    })

    it('approves files that contain autonoe but not .autonoe/', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: 'src/autonoe-config.ts' },
      })

      expect(result.decision).toBe('approve')
    })

    it('blocks hidden .autonoe in nested path', async () => {
      const hook = createAutonoeProtectionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { file_path: 'deep/nested/.autonoe/file.json' },
      })

      expect(result.decision).toBe('block')
    })
  })
})

describe('Sync Write Restriction', () => {
  describe('SYNC_ALLOWED_WRITE_PATHS', () => {
    it('contains .autonoe-note.md', () => {
      expect(SYNC_ALLOWED_WRITE_PATHS).toContain('.autonoe-note.md')
    })
  })

  describe('createSyncWriteRestrictionHook', () => {
    it('has correct name', () => {
      const hook = createSyncWriteRestrictionHook()
      expect(hook.name).toBe('sync-write-restriction')
    })

    it('has correct matcher for Edit|Write', () => {
      const hook = createSyncWriteRestrictionHook()
      expect(hook.matcher).toBe('Edit|Write')
    })
  })

  describe('SC-SWR001: Allow .autonoe-note.md', () => {
    it('approves write to .autonoe-note.md', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: '.autonoe-note.md' },
      })

      expect(result.decision).toBe('approve')
      expect(result.continue).toBe(true)
    })

    it('approves write to /project/.autonoe-note.md', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { file_path: '/project/.autonoe-note.md' },
      })

      expect(result.decision).toBe('approve')
    })
  })

  describe('SC-SWR002: Block all other files', () => {
    it('blocks write to src/index.ts', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: 'src/index.ts' },
      })

      expect(result.decision).toBe('block')
      expect(result.continue).toBe(false)
      expect(result.reason).toContain('Sync mode')
    })

    it('blocks write to package.json', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { file_path: 'package.json' },
      })

      expect(result.decision).toBe('block')
    })

    it('blocks write to README.md', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: 'README.md' },
      })

      expect(result.decision).toBe('block')
    })
  })

  describe('SC-SWR003: Handle undefined file_path', () => {
    it('approves when file_path is undefined', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: {},
      })

      expect(result.decision).toBe('approve')
      expect(result.continue).toBe(true)
    })
  })

  describe('SC-SWR004: Handle camelCase filePath', () => {
    it('approves .autonoe-note.md with camelCase filePath', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { filePath: '.autonoe-note.md' },
      })

      expect(result.decision).toBe('approve')
    })

    it('blocks other files with camelCase filePath', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { filePath: 'src/app.ts' },
      })

      expect(result.decision).toBe('block')
    })
  })

  describe('SC-SWR005: Handle Windows paths', () => {
    it('approves Windows path to .autonoe-note.md', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Write',
        toolInput: { file_path: 'C:\\project\\.autonoe-note.md' },
      })

      expect(result.decision).toBe('approve')
    })

    it('blocks Windows path to other files', async () => {
      const hook = createSyncWriteRestrictionHook()
      const result = await hook.callback({
        toolName: 'Edit',
        toolInput: { file_path: 'C:\\project\\src\\index.ts' },
      })

      expect(result.decision).toBe('block')
    })
  })
})
