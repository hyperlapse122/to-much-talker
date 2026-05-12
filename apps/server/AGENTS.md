# AGENTS — @to-much-talker/server

This is the Discord TTS bot server application.

## Module Map

```
src/
  index.ts          — Main entry: parse CLI, load config, dispatch to role
  cli.ts            — commander CLI (start/key/migrate subcommands)
  logger.ts         — Pino logger instance with redaction
  bot/
    index.ts        — runBotWorker() + runClusterManager() dispatchers
    client.ts       — Discord.js Client setup (Task 13)
    commands-registry.ts  — Slash command registration (Task 13)
    locale-bridge.ts      — Locale-to-Discord-locale mapping (Task 13)
  voice/
    player.ts       — Per-guild Player (Task 14)
    pipeline.ts     — audioBytesToOpus() (Task 14)
    connection.ts   — joinVoice() (Task 14)
    resource.ts     — createAudioResourceFromBuffer() (Task 14)
  queue/
    manager.ts      — Per-channel queue manager (Task 15)
    strategies/     — drop-oldest, drop-newest, interrupt (Task 15)
  commands/
    tts/
      join.ts       — /tts join (Task 19)
      leave.ts      — /tts leave (Task 19)
      say.ts        — /tts say (Task 20)
      settings/     — /tts settings * (Task 21)
  setup/
    wizard.ts       — /tts setup (Task 22)
    welcome.ts      — guildCreate DM (Task 22)
  ipc/
    hybridTransport.ts  — IpcTransport impl (Task 17)
  cli/
    keyRotate.ts    — key rotate cmd (Task 18)
```

## Critical Rules

- NEVER log tokens, API keys, or authorization headers — pino redaction is configured
- NEVER `process.exit()` outside the main entrypoint and CLI action modules
- NEVER let a Discord interaction time out — always reply() or editReply()
- Discord rate limits: queue multi-embed responses; never burst
- Voice connections: always clean up on error/disconnect (player.stop() + connection.destroy())
- All user-facing strings MUST come from `@to-much-talker/i18n` message keys — no hardcoded English

## Build — Vite 8 (mandatory)

The server is bundled with Vite 8 in SSR/library mode. **Do not use `tsc` to emit.**

- `build` script: `vite build` (bundles the server entrypoint to `dist/index.js`)
- `typecheck` script: `tsc --noEmit` (no emit, type-check only)
- Output is a single ESM bundle. Workspace packages (`@to-much-talker/*`) and
  every npm dependency listed in `package.json` MUST be inlined.
- `ssr.noExternal: true` in `vite.config.ts` — nothing is external by default.
- A package may stay external only for one of two reasons:
  - **Ships a `.node` binary** (no JS to bundle), or
  - **Uses direct `eval(string)`** — bundling rewrites the surrounding
    scope so the eval'd code no longer sees the variables it expects.
- Current external list:
  - `@discordjs/opus` — native (Opus codec `.node`)
  - `better-sqlite3` — native (SQLite `.node`)
  - `bufferutil` / `utf-8-validate` / `zlib-sync` — optional ws/discord.js
    natives, kept external so discord.js's `try { require(...) } catch {}`
    fallbacks behave identically to a non-bundled install
  - `discord.js` — calls `eval(script)` in `Client#eval` for cluster IPC
  - `discord-hybrid-sharding` — evals user scripts in
    `ClusterManager#broadcastEval` and `ClusterClient#_eval`
- Adding a new native or eval-using dependency? Append it to the
  `runtimeExternals` list in `vite.config.ts` AND document why here.
- Adding a new pure-JS dependency? Do nothing — it gets bundled automatically.

The bundled `dist/index.js` is the production entrypoint. Native externals are
resolved at runtime from `node_modules`, which Docker preserves in the runtime
stage. No source TypeScript or workspace `src/` is loaded at runtime.

## Runtime Discipline

- ALWAYS run `yarn workspace @to-much-talker/server build` before starting or
  restarting the bot.
- Start the bot with `yarn workspace @to-much-talker/server start`, which runs
  `node --env-file=.env dist/index.js start`.
- NEVER run server source files directly at runtime.
- NEVER use `tsx` for server runtime or operational commands; build first and
  run `dist/index.js`.

## Logger Discipline

Use child loggers in every module:

```typescript
import { logger } from '../logger.js'
const log = logger.child({ component: 'voice/player' })
log.info({ guildId }, 'Playing track')
```

Never call `console.*` — eslint enforces this everywhere except `src/cli/**`.
Use `process.stdout.write` / `process.stderr.write` for raw CLI output that must
not be JSON-formatted (e.g. `key gen` prints a single key value).

## CLI Surface

```
tmt-bot [command]

Commands:
  start                 Start the bot (default; auto-detects cluster vs worker)
  key gen               Generate a new AES-256-GCM master key (prints base64)
  key rotate --new-key  Rotate master key (re-encrypts all stored keys) — Task 18
  migrate               Run database migrations only
```

## Role Auto-Detection

The same binary runs as cluster manager OR bot worker. We auto-detect:

- If `process.env.CLUSTER` is set → worker (spawned by discord-hybrid-sharding)
- Otherwise → manager (top-level entrypoint)

This means `node dist/index.js start` always Just Works, whether you exec it
directly (manager) or it's exec'd by the ClusterManager (worker).
