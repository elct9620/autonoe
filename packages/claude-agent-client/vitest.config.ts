import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'claude-agent-client',
    environment: 'node',
  },
})
