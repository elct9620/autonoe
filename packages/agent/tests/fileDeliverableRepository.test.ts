import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { FileDeliverableRepository } from '../src/fileDeliverableRepository'
import type { DeliverableStatus } from '@autonoe/core'

describe('FileDeliverableRepository', () => {
  let tempDir: string
  let repo: FileDeliverableRepository

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autonoe-test-'))
    repo = new FileDeliverableRepository(tempDir)
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('exists()', () => {
    it('returns false when status.json does not exist', async () => {
      const result = await repo.exists()
      expect(result).toBe(false)
    })

    it('returns true when status.json exists', async () => {
      // Create .autonoe directory and status.json
      const autonoeDir = path.join(tempDir, '.autonoe')
      await fs.mkdir(autonoeDir, { recursive: true })
      await fs.writeFile(
        path.join(autonoeDir, 'status.json'),
        '{"deliverables":[]}',
      )

      const result = await repo.exists()
      expect(result).toBe(true)
    })
  })

  describe('load()', () => {
    it('returns empty status when file does not exist', async () => {
      const status = await repo.load()
      expect(status.deliverables).toEqual([])
      expect(status.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(status.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns status from file', async () => {
      const expected: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test Deliverable',
            acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
            passed: true,
            blocked: false,
          },
        ],
      }

      const autonoeDir = path.join(tempDir, '.autonoe')
      await fs.mkdir(autonoeDir, { recursive: true })
      await fs.writeFile(
        path.join(autonoeDir, 'status.json'),
        JSON.stringify(expected),
      )

      const status = await repo.load()
      expect(status).toEqual(expected)
    })

    it('returns empty status for malformed JSON', async () => {
      const autonoeDir = path.join(tempDir, '.autonoe')
      await fs.mkdir(autonoeDir, { recursive: true })
      await fs.writeFile(path.join(autonoeDir, 'status.json'), 'not valid json')

      const status = await repo.load()
      expect(status.deliverables).toEqual([])
      expect(status.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns empty status for JSON without deliverables array', async () => {
      const autonoeDir = path.join(tempDir, '.autonoe')
      await fs.mkdir(autonoeDir, { recursive: true })
      await fs.writeFile(path.join(autonoeDir, 'status.json'), '{"foo":"bar"}')

      const status = await repo.load()
      expect(status.deliverables).toEqual([])
      expect(status.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('save()', () => {
    it('creates .autonoe directory if not exists', async () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [],
      }
      await repo.save(status)

      const dirExists = await fs
        .access(path.join(tempDir, '.autonoe'))
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(true)
    })

    it('writes status to file with updated timestamp', async () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Test',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }

      await repo.save(status)

      const content = await fs.readFile(
        path.join(tempDir, '.autonoe', 'status.json'),
        'utf-8',
      )
      const saved = JSON.parse(content)
      // updatedAt is refreshed on save
      expect(saved.createdAt).toBe(status.createdAt)
      expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(saved.deliverables).toEqual(status.deliverables)
    })

    it('overwrites existing file', async () => {
      const initial: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Initial',
            acceptanceCriteria: ['Criterion'],
            passed: false,
            blocked: false,
          },
        ],
      }
      const updated: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'Initial',
            acceptanceCriteria: ['Criterion'],
            passed: true,
            blocked: false,
          },
        ],
      }

      await repo.save(initial)
      await repo.save(updated)

      const content = await fs.readFile(
        path.join(tempDir, '.autonoe', 'status.json'),
        'utf-8',
      )
      const saved = JSON.parse(content)
      expect(saved.deliverables).toEqual(updated.deliverables)
      expect(saved.createdAt).toBe(updated.createdAt)
    })

    it('writes pretty-formatted JSON', async () => {
      const status: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [],
      }
      await repo.save(status)

      const content = await fs.readFile(
        path.join(tempDir, '.autonoe', 'status.json'),
        'utf-8',
      )
      // Pretty formatted JSON has newlines
      expect(content).toContain('\n')
    })
  })

  describe('round-trip', () => {
    it('load after save returns same deliverables with updated timestamp', async () => {
      const original: DeliverableStatus = {
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        deliverables: [
          {
            id: 'DL-001',
            description: 'First',
            acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
            passed: false,
            blocked: false,
          },
          {
            id: 'DL-002',
            description: 'Second',
            acceptanceCriteria: ['Criterion 3'],
            passed: true,
            blocked: false,
          },
        ],
      }

      await repo.save(original)
      const loaded = await repo.load()

      expect(loaded.deliverables).toEqual(original.deliverables)
      expect(loaded.createdAt).toBe(original.createdAt)
      // updatedAt is refreshed on save
      expect(loaded.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
