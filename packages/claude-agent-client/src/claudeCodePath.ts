import { execSync } from 'child_process'

const isWindows = process.platform === 'win32'

/**
 * Detect Claude Code executable path using system commands
 * @returns Path to Claude Code executable, or undefined if not found
 */
export function detectClaudeCodePath(): string | undefined {
  try {
    const command = isWindows ? 'where claude' : 'which claude'
    const result = execSync(command, { encoding: 'utf-8' }).trim()
    // 'where' on Windows may return multiple lines, take first
    return result.split('\n')[0] || undefined
  } catch {
    return undefined
  }
}
