import type { Config } from '@to-much-talker/config'
import type { Logger } from '../logger.js'
import { createClient } from './client.js'
import { InteractionRouter } from './router.js'

// Module-level router instance. Slash command handlers (Tasks 19-23) will
// register themselves against this router before login.
const router = new InteractionRouter()

/**
 * Run the bot as a worker process (one cluster shard).
 *
 * Boots a Discord.js client, attaches the interaction router, and logs in.
 * Cluster/sharding integration (discord-hybrid-sharding) lands in Task 17.
 */
export async function runBotWorker(config: Config, log: Logger): Promise<void> {
  log.info({ role: 'worker' }, 'Bot worker starting')

  const client = createClient(config)
  router.attachTo(client)

  await client.login(config.DISCORD_TOKEN)
  log.info('Bot logged in to Discord')
}

/**
 * Run the bot as a cluster manager (spawns + supervises worker processes).
 *
 * Placeholder — actual discord-hybrid-sharding ClusterManager wiring lands in Task 17.
 */
export async function runClusterManager(_config: Config, log: Logger): Promise<void> {
  log.info('Cluster manager starting (placeholder — see Task 17)')
}
