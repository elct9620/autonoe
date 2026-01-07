import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  Deliverable,
  DeliverableStatus,
  type DeliverableRepository,
} from '@autonoe/core'

const AUTONOE_DIR = '.autonoe'
const STATUS_FILE = 'status.json'

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]!
}

/**
 * JSON structure for deliverable in status file
 */
interface DeliverableJson {
  id: string
  description: string
  acceptanceCriteria: string[]
  passed: boolean
  blocked: boolean
}

/**
 * JSON structure for status file
 */
interface StatusJson {
  createdAt: string
  updatedAt: string
  deliverables: DeliverableJson[]
}

/**
 * Convert JSON data to DeliverableStatus class instance
 */
function toDeliverableStatus(data: StatusJson): DeliverableStatus {
  return DeliverableStatus.create(
    data.createdAt,
    data.updatedAt,
    data.deliverables.map((d) =>
      Deliverable.create(
        d.id,
        d.description,
        d.acceptanceCriteria,
        d.passed,
        d.blocked,
      ),
    ),
  )
}

/**
 * File-based implementation of DeliverableRepository
 * Persists deliverable status to .autonoe/status.json
 */
export class FileDeliverableRepository implements DeliverableRepository {
  private readonly statusPath: string

  constructor(private projectDir: string) {
    this.statusPath = path.join(projectDir, AUTONOE_DIR, STATUS_FILE)
  }

  /**
   * Check if status.json exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.statusPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Load status from file, or return empty status if not exists
   */
  async load(): Promise<DeliverableStatus> {
    try {
      const content = await fs.readFile(this.statusPath, 'utf-8')
      const data = JSON.parse(content) as StatusJson

      // Validate structure
      if (!data.deliverables || !Array.isArray(data.deliverables)) {
        return DeliverableStatus.empty()
      }

      return toDeliverableStatus(data)
    } catch {
      return DeliverableStatus.empty()
    }
  }

  /**
   * Save status to file, creating directory if needed
   * Updates updatedAt timestamp on every save
   */
  async save(status: DeliverableStatus): Promise<void> {
    const dir = path.dirname(this.statusPath)

    // Ensure .autonoe directory exists
    await fs.mkdir(dir, { recursive: true })

    // Update timestamp and serialize to JSON
    const now = getCurrentDate()
    const statusWithTimestamp = status.withUpdatedAt(now)
    const json: StatusJson = {
      createdAt: statusWithTimestamp.createdAt,
      updatedAt: statusWithTimestamp.updatedAt,
      deliverables: statusWithTimestamp.deliverables.map((d) => ({
        id: d.id,
        description: d.description,
        acceptanceCriteria: [...d.acceptanceCriteria],
        passed: d.passed,
        blocked: d.blocked,
      })),
    }

    // Write status file with pretty formatting
    const content = JSON.stringify(json, null, 2)
    await fs.writeFile(this.statusPath, content, 'utf-8')
  }
}
