import { readFileSync } from 'node:fs'
import { defineProject } from 'vitest/config'
import type { Plugin } from 'vite'

/**
 * Plugin to handle markdown imports with { type: 'text' } assertion
 * Vite doesn't natively support import assertions, so we handle .md files as raw text
 */
function markdownPlugin(): Plugin {
  return {
    name: 'markdown-raw',
    transform(code, id) {
      if (id.endsWith('.md')) {
        const content = readFileSync(id, 'utf-8')
        return {
          code: `export default ${JSON.stringify(content)}`,
          map: null,
        }
      }
    },
  }
}

export default defineProject({
  plugins: [markdownPlugin()],
  test: {
    name: 'core',
    environment: 'node',
  },
})
