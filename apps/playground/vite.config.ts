import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: 'src/app',
      generatedRouteTree: 'src/routeTree.gen.ts',
    }),
    viteReact(),
    tailwindcss(),
  ],
  server: {
    host: process.env['PLAYGROUND_HOST'] ?? '127.0.0.1',
    port: parseInt(process.env['PLAYGROUND_PORT'] ?? '5173', 10),
  },
})
