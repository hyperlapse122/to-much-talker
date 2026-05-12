import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import viteReact from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const contentCollectionsModuleId = '\0test-content-collections'

const contentCollectionsTestPlugin = {
  name: 'docs-test-content-collections',
  resolveId(id: string): string | undefined {
    return id === 'content-collections' ? contentCollectionsModuleId : undefined
  },
  load(id: string): string | undefined {
    return id === contentCollectionsModuleId ? 'export const allDocs = []' : undefined
  },
} satisfies Plugin

export default defineConfig({
  plugins: [contentCollectionsTestPlugin, viteReact()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**', 'src/components/**', 'src/lib/**'],
      exclude: ['src/**/*.test.*', 'src/**/*.spec.*'],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
})
