#!/usr/bin/env node
/**
 * Dev runner for `@to-much-talker/server`.
 *
 * Mirrors the "vite dev" UX for our Node-only Discord bot:
 *   1. Vite's `loadEnv` reads `.env`, `.env.local`, `.env.development[.local]`
 *      from the repo root and injects them into `process.env` (similar to how
 *      `vite` injects env for a frontend dev server).
 *   2. `vite build --watch` (programmatic) keeps `dist/index.js` in sync with
 *      source changes.
 *   3. `node --watch dist/index.js start` runs the bot and restarts it on
 *      rebundle.
 *
 * Production (the Docker image and `yarn start`) does NOT use this script.
 * Env vars come from the orchestrator (`docker run --env-file`, k8s, systemd)
 * and the bot is invoked as `node apps/server/dist/index.js start` directly.
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build, loadEnv } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')

// `loadEnv(mode, dir, prefixes)`:
//   - `mode` controls which `.env.[mode]*` files are merged in.
//   - `dir` is where to look for `.env*` files (our `.env` lives at repo root).
//   - `prefixes = ''` disables the `VITE_*` prefix filter. This is safe because
//     the server is a Node-only bundle — there is no client to leak to. The
//     production `vite build` still uses the default `envPrefix` (`VITE_`),
//     so unprefixed secrets are never inlined into `dist/index.js`.
const env = loadEnv('development', repoRoot, '')
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) {
    process.env[key] = value
  }
}

// Programmatic `vite build --watch`. Returns a Rollup watcher that emits
// `BUNDLE_END` on every successful rebuild.

/**
 * @type {import('rolldown').RolldownWatcher}
 */
const watcher = /** @type {import('rolldown').RolldownWatcher} */ (
  await build({
    configFile: resolve(here, 'vite.config.ts'),
    mode: 'development',
    build: { watch: {} },
  })
)

/**
 * @type {import('node:child_process').ChildProcess | null}
 */
let bot = null
watcher.on('event', (ev) => {
  if (ev.code === 'BUNDLE_END' && bot === null) {
    // First successful build → kick off the bot. `node --watch` then handles
    // subsequent restarts each time Vite rewrites `dist/index.js`.
    bot = spawn(process.execPath, ['--watch', 'dist/index.js', 'start'], {
      cwd: here,
      env: process.env,
      stdio: 'inherit',
    })
    bot.on('exit', (code) => process.exit(code ?? 0))
  }
})

/**
 * @param {NodeJS.Signals} signal
 */
const shutdown = (signal) => {
  watcher.close()
  if (bot) bot.kill(signal)
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
