import { defineConfig } from 'vite'

// Native modules that ship `.node` binaries and CANNOT be bundled.
// These are loaded via Node's `require` at runtime from `node_modules`.
//
// Adding a new entry? Document the reason in `AGENTS.md` and ensure the
// package is listed in `apps/server/package.json` `dependencies` so the
// Docker runtime stage installs it (or copies it from the builder).
const nativeExternals = [
  // Opus codec for voice — has `prebuild/<abi>/opus.node`
  '@discordjs/opus',
  // SQLite driver — has `build/Release/better_sqlite3.node`
  'better-sqlite3',
  // discord.js / ws optional natives. NOT in our dependencies; left external
  // so discord.js's runtime `try { require(...) } catch {}` fallbacks work
  // when they happen to be installed and silently skip when they aren't.
  'bufferutil',
  'utf-8-validate',
  'zlib-sync',
]

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  build: {
    target: 'esnext',
    ssr: 'src/index.ts',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      external: nativeExternals,
      output: {
        format: 'esm',
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        // Shebang + ESM polyfills for bundled CJS code that references
        // `__dirname`, `__filename`, or `require` (e.g. discord-hybrid-sharding).
        // `import.meta.dirname` / `filename` need Node 20.11+; we target Node 24.
        banner: [
          '#!/usr/bin/env node',
          "import { createRequire as __toMuchTalkerCreateRequire } from 'node:module';",
          'const require = __toMuchTalkerCreateRequire(import.meta.url);',
          'const __filename = import.meta.filename;',
          'const __dirname = import.meta.dirname;',
        ].join('\n'),
      },
    },
  },
  // SSR build: bundle EVERYTHING from node_modules and the workspace,
  // except the explicit native externals above.
  ssr: {
    target: 'node',
    noExternal: true,
    external: nativeExternals,
  },
  // Help Vite's dep-scanner resolve workspace `.ts` exports.
  // (`packages/*/package.json` use `"exports": { ".": "./src/index.ts" }`.)
  resolve: {
    conditions: ['node', 'import', 'default'],
  },
})
