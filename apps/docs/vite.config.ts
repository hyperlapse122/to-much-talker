import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const docsBasePath = process.env.DOCS_BASE_PATH ?? '/'

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  base: docsBasePath,
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 4000,
  },
})
