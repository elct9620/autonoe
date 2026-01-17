import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import {
  initializerInstruction,
  codingInstruction,
  syncInstruction,
  verifyInstruction,
  type SessionRunnerOptions,
  type InstructionResolver,
  type InstructionName,
  type DeliverableStatusCallback,
  type DeliverableStatusNotification,
  type Logger,
  type StreamEventCallback,
} from '@autonoe/core'
import type { ValidatedCommonOptions } from './options'

/**
 * Create an instruction resolver with override support
 * Allows users to customize instructions via .autonoe/{name}.md files
 */
export function createInstructionResolver(
  projectDir: string,
): InstructionResolver {
  const defaultInstructions: Record<InstructionName, string> = {
    initializer: initializerInstruction,
    coding: codingInstruction,
    sync: syncInstruction,
    verify: verifyInstruction,
  }

  return {
    async resolve(name: InstructionName): Promise<string> {
      const overridePath = join(projectDir, '.autonoe', `${name}.md`)
      try {
        return await readFile(overridePath, 'utf-8')
      } catch {
        return defaultInstructions[name]
      }
    },
  }
}

/**
 * Format status icon for deliverable status changes
 */
export function formatStatusIcon(
  status: DeliverableStatusNotification['newStatus'],
): string {
  switch (status) {
    case 'passed':
      return '[PASS]'
    case 'blocked':
      return '[BLOCKED]'
    default:
      return '[PENDING]'
  }
}

/**
 * Create a status change callback that logs deliverable updates
 */
export function createStatusChangeCallback(
  logger: Logger,
): DeliverableStatusCallback {
  return (notification) => {
    const icon = formatStatusIcon(notification.newStatus)
    logger.info(
      `${icon} ${notification.deliverableDescription} (${notification.deliverableId})`,
    )
  }
}

/**
 * Create SessionRunnerOptions from validated options
 */
export function createRunnerOptions(
  options: ValidatedCommonOptions,
  onStreamEvent?: StreamEventCallback,
): SessionRunnerOptions {
  return {
    projectDir: options.projectDir,
    maxIterations: options.maxIterations,
    maxRetries: options.maxRetries,
    model: options.model,
    waitForQuota: options.waitForQuota,
    maxThinkingTokens: options.maxThinkingTokens,
    onStreamEvent,
  }
}
