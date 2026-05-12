import type { Config } from '@to-much-talker/config'
import { openDb } from '@to-much-talker/db'
import { NoopIpcTransport, SettingsCache } from '@to-much-talker/settings-core'
import { createClient } from '../bot/client.js'
import { attachMessageReader } from '../bot/message-reader.js'
import { InteractionRouter } from '../bot/router.js'
import type { CommandContext } from '../commands/context.js'
import { registerCommandHandlers } from '../commands/index.js'
import { invalidateTtsRuntimeCache } from '../commands/tts/runtime-cache.js'
import { logger } from '../logger.js'
import { HybridShardingIpcTransport } from './ipc.js'

const log = logger.child({ component: 'cluster/worker' })

export async function runBotWorker(config: Config): Promise<void> {
  log.info({ cluster: process.env.CLUSTER }, 'Bot worker starting')

  const dbResult = await openDb(config.DATABASE_URL)
  if (!dbResult.ok) {
    log.error({ error: dbResult.error.message }, 'Failed to open database')
    process.exit(1)
  }
  const db = dbResult.value

  const settingsCache = new SettingsCache()
  const ipcTransport =
    process.env.CLUSTER !== undefined ? new HybridShardingIpcTransport() : new NoopIpcTransport()

  ipcTransport.onInvalidate((guildId) => {
    log.debug({ guildId }, 'Settings cache invalidated via IPC')
    settingsCache.invalidate(guildId)
    invalidateTtsRuntimeCache(guildId)
  })

  const client = createClient(config)
  const router = new InteractionRouter()

  // Build the shared command context AFTER the client exists but BEFORE
  // handlers are registered; every `/tts` handler resolves dependencies via
  // this context, so it must be populated before the router starts dispatching.
  const ctx: CommandContext = {
    client,
    config,
    db,
    settingsCache,
    ipcTransport,
    logger,
  }

  // Wire every `/tts` subcommand handler into the router BEFORE attaching the
  // router to the Discord client. Skipping this step makes `dispatch()` miss
  // for every interaction and silently reply with "Unknown command".
  registerCommandHandlers(router, ctx)
  router.attachTo(client)
  attachMessageReader(client, ctx)

  await client.login(config.DISCORD_TOKEN)
  log.info('Bot worker logged in to Discord')

  process.on('SIGTERM', () => {
    log.info('SIGTERM received; worker shutting down gracefully')
    void (async () => {
      try {
        await client.destroy()
        if (db.dialect === 'sqlite') {
          db.close()
        } else {
          await db.close()
        }
      } catch (error) {
        log.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Worker shutdown encountered an error',
        )
      } finally {
        process.exit(0)
      }
    })()
  })
}
