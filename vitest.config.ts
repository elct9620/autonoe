import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
    reporters: ['default', 'junit'],
    outputFile: './test-report.junit.xml',
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/tests/**', '**/node_modules/**'],
    },
  },
})
