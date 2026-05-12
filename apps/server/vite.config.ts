import { defineConfig } from 'vite'

// Packages that CANNOT be bundled, loaded via Node's `require` at runtime
// from `node_modules`. Three reasons something lands here:
//
//   1. Ships a native `.node` binary (no JS to bundle).
//   2. Resolves runtime worker/helper files relative to its package folder.
//   3. Uses direct `eval(string)` which rolldown rewrites/inlines unsafely
//      and which never minifies cleanly. Keeping the package external
//      preserves the original `eval()` semantics and the package's own
//      `require.resolve` / `__dirname` lookups.
//
// Adding a new entry? Document the reason in `AGENTS.md` and ensure the
// package is listed in `apps/server/package.json` `dependencies` so the
// Docker runtime stage carries it forward.
const runtimeExternals = [
  // (1) Native: Opus codec for voice — has `prebuild/<abi>/opus.node`
  '@discordjs/opus',
  // (1) Native: SQLite driver — has `build/Release/better_sqlite3.node`
  'better-sqlite3',
  // (1) Native (optional): discord.js / ws fast-path natives. NOT in our
  // dependencies; left external so discord.js's runtime
  // `try { require(...) } catch {}` fallbacks work when they happen to be
  // installed and silently skip when they aren't.
  'bufferutil',
  'utf-8-validate',
  'zlib-sync',
  // (1) Native: `@discordjs/voice` pulls in `@snazzah/davey` (DAVE protocol)
  // which ships platform-specific `.node` binaries via optional deps
  // (`@snazzah/davey-linux-x64-gnu`, etc). Keeping voice external prevents
  // rolldown from walking into those native modules at bundle time.
  '@discordjs/voice',
  // (1) Native (transitive defense-in-depth): even if some other code path
  // pulls in davey directly, never try to bundle its native bindings. The
  // platform-specific sibling packages (`@snazzah/davey-linux-x64-gnu`,
  // `@snazzah/davey-darwin-arm64`, ...) are resolved by davey's own
  // `require()` at runtime, so listing the parent is sufficient.
  '@snazzah/davey',
  // (1) Native: `prism-media` uses a dynamic `require()` loader to
  // resolve optional native opus/ffmpeg backends (`@discordjs/opus`,
  // `node-opus`, `opusscript`, `ffmpeg-static`). Bundling rewrites the
  // require scope and breaks the loader's runtime fallback.
  'prism-media',
  // (2) Runtime worker: pino/thread-stream resolves `lib/worker.js` relative to
  // pino's package root at runtime. Bundling makes it look under app dist.
  'pino',
  // (3) Eval: `discord.js` calls `eval(script)` in Client#eval for cluster
  // IPC payloads (src/client/Client.js); bundling breaks scope capture.
  'discord.js',
  // (3) Eval: `discord-hybrid-sharding` evals user scripts in
  // ClusterManager#broadcastEval and ClusterClient#_eval. Bundling rewrites
  // the surrounding scope and breaks the broadcast contract.
  'discord-hybrid-sharding',
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
      external: runtimeExternals,
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
  // except the explicit runtime externals above.
  ssr: {
    target: 'node',
    noExternal: true,
    external: runtimeExternals,
  },
  // Help Vite's dep-scanner resolve workspace `.ts` exports.
  // (`packages/*/package.json` use `"exports": { ".": "./src/index.ts" }`.)
  resolve: {
    conditions: ['node', 'import', 'default'],
  },
})
