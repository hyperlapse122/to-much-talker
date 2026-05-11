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
- NEVER `process.exit()` outside `src/index.ts` main() and CLI actions in `src/cli.ts` / `src/cli/**`
- NEVER let a Discord interaction time out — always reply() or editReply()
- Discord rate limits: queue multi-embed responses; never burst
- Voice connections: always clean up on error/disconnect (player.stop() + connection.destroy())
- All user-facing strings MUST come from `@to-much-talker/i18n` message keys — no hardcoded English

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
