/**
 * Shell command parsing utilities
 */

export interface ParsedCommand {
  base: string
  fullCommand: string
  args: string[]
}

/**
 * Split command string into individual commands by chain operators
 * Handles: &&, ||, |, ;
 */
export function splitCommandChain(command: string): string[] {
  const commands: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]
    const nextChar = command[i + 1]

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      current += char
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      current += char
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      current += char
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      // Check for operators
      if (char === ';') {
        if (current.trim()) commands.push(current.trim())
        current = ''
        continue
      }

      if (char === '|') {
        if (nextChar === '|') {
          // ||
          if (current.trim()) commands.push(current.trim())
          current = ''
          i++ // skip next |
          continue
        } else {
          // single pipe
          if (current.trim()) commands.push(current.trim())
          current = ''
          continue
        }
      }

      if (char === '&' && nextChar === '&') {
        if (current.trim()) commands.push(current.trim())
        current = ''
        i++ // skip next &
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    commands.push(current.trim())
  }

  return commands
}

/**
 * Parse a single command into base command, full command path, and arguments
 */
export function parseCommand(command: string): ParsedCommand {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  if (tokens.length === 0) {
    return { base: '', fullCommand: '', args: [] }
  }

  // Extract base command name (handle paths like /usr/bin/git)
  const fullCommand = tokens[0]!
  const base = fullCommand.includes('/')
    ? (fullCommand.split('/').pop() ?? fullCommand)
    : fullCommand

  return { base, fullCommand, args: tokens.slice(1) }
}
