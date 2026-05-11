import type { Config } from '@to-much-talker/config'
import { NoopIpcTransport, SettingsCache } from '@to-much-talker/settings-core'
import { createClient } from '../bot/client.js'
import { InteractionRouter } from '../bot/router.js'
import { logger } from '../logger.js'
import { HybridShardingIpcTransport } from './ipc.js'

const log = logger.child({ component: 'cluster/worker' })

export async function runBotWorker(config: Config): Promise<void> {
  log.info({ cluster: process.env.CLUSTER }, 'Bot worker starting')

  const settingsCache = new SettingsCache()
  const ipcTransport =
    process.env.CLUSTER !== undefined ? new HybridShardingIpcTransport() : new NoopIpcTransport()

  ipcTransport.onInvalidate((guildId) => {
    log.debug({ guildId }, 'Settings cache invalidated via IPC')
    settingsCache.invalidate(guildId)
  })

  const client = createClient(config)
  const router = new InteractionRouter()
  router.attachTo(client)

  await client.login(config.DISCORD_TOKEN)
  log.info('Bot worker logged in to Discord')

  process.on('SIGTERM', () => {
    log.info('SIGTERM received; worker shutting down gracefully')
    client.destroy()
    process.exit(0)
  })
}
