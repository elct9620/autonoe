import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DeliverableRepository, DeliverableStatus } from '@autonoe/core'
import { emptyDeliverableStatus } from '@autonoe/core'

const AUTONOE_DIR = '.autonoe'
const STATUS_FILE = 'status.json'

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
      const data = JSON.parse(content) as DeliverableStatus

      // Validate structure
      if (!data.deliverables || !Array.isArray(data.deliverables)) {
        return emptyDeliverableStatus()
      }

      return data
    } catch {
      return emptyDeliverableStatus()
    }
  }

  /**
   * Save status to file, creating directory if needed
   */
  async save(status: DeliverableStatus): Promise<void> {
    const dir = path.dirname(this.statusPath)

    // Ensure .autonoe directory exists
    await fs.mkdir(dir, { recursive: true })

    // Write status file with pretty formatting
    const content = JSON.stringify(status, null, 2)
    await fs.writeFile(this.statusPath, content, 'utf-8')
  }
}
