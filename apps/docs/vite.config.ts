import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import contentCollections from '@content-collections/vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const docsBasePath = process.env['DOCS_BASE_PATH'] ?? '/'

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  base: docsBasePath,
  plugins: [
    TanStackRouterVite({
      routesDirectory: 'src/app',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    contentCollections(),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4000,
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
})
