import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config } from '@to-much-talker/config'
import { openDb, runMigrations } from '@to-much-talker/db'
import { ClusterManager } from 'discord-hybrid-sharding'

import { registerCommands } from '../bot/commands-registry.js'
import { logger } from '../logger.js'
import { isIpcMessage } from './ipc.js'

const log = logger.child({ component: 'cluster/manager' })
const currentDir = dirname(fileURLToPath(import.meta.url))

export async function runClusterManager(config: Config): Promise<void> {
  log.info('Cluster manager starting')

  const dbResult = await openDb(config.DATABASE_URL)
  if (!dbResult.ok) {
    log.error({ error: dbResult.error.message }, 'Failed to open DB for migrations')
    process.exit(1)
  }

  log.info('Running database migrations')
  await runMigrations(dbResult.value)
  await dbResult.value.close()
  log.info('Migrations complete')

  await registerCommands(config)

  const totalShards = config.TOTAL_SHARDS === 'auto' ? 'auto' : parseInt(config.TOTAL_SHARDS, 10)
  const workerPath = join(currentDir, '..', '..', 'dist', 'index.js')

  const manager = new ClusterManager(workerPath, {
    totalShards,
    totalClusters: config.CLUSTER_COUNT,
    mode: 'process',
    token: config.DISCORD_TOKEN,
    execArgv: ['--env-file=.env'],
  })

  manager.on('clusterCreate', (cluster) => {
    log.info({ clusterId: cluster.id }, 'Cluster spawned')

    cluster.on('death', () => {
      log.error({ clusterId: cluster.id }, 'Cluster died; discord-hybrid-sharding will restart it')
    })

    cluster.on('message', (msg: unknown) => {
      if (!isIpcMessage(msg)) return
      if (msg.type !== 'settings:invalidate') return

      log.debug(
        { guildId: msg.payload.guildId, sourceClusterId: cluster.id },
        'Manager relaying settings:invalidate to all clusters',
      )

      for (const target of manager.clusters.values()) {
        target.send(msg)
      }
    })
  })

  process.on('SIGTERM', () => {
    log.info('SIGTERM received; shutting down cluster manager')
    void (async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30_000)
      })
      process.exit(0)
    })().catch((error: unknown) => {
      log.error({ error }, 'Cluster manager shutdown failed')
      process.exit(1)
    })
  })

  await manager.spawn({ timeout: -1 })
  log.info('All clusters spawned successfully')
}
