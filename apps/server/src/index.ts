import { loadConfigOrExit } from '@to-much-talker/config'

import { runBotWorker, runClusterManager } from './bot/index.js'
import { parseCli } from './cli.js'
import { logger } from './logger.js'

async function main(): Promise<void> {
  const cli = parseCli(process.argv)

  // `key gen` and `key rotate` exit inside parseCli via commander actions.
  // If control reaches here for those commands, it's a no-op (defensive).
  if (cli.command === 'key-gen' || cli.command === 'key-rotate') {
    return
  }

  const config = loadConfigOrExit()

  if (cli.command === 'migrate') {
    const { openDb, runMigrations } = await import('@to-much-talker/db')
    const dbResult = await openDb(config.DATABASE_URL)
    if (!dbResult.ok) {
      logger.error({ error: dbResult.error.message }, 'Failed to open database')
      process.exit(1)
    }
    await runMigrations(dbResult.value)
    logger.info('Migrations complete')
    if (dbResult.value.dialect === 'sqlite') {
      dbResult.value.close()
    } else {
      await dbResult.value.close()
    }
    return
  }

  // Auto-detect role: discord-hybrid-sharding sets `CLUSTER` env var in workers.
  const isWorker = process.env.CLUSTER !== undefined
  const isManager = !isWorker

  if (isManager) {
    logger.info({ role: 'cluster-manager' }, 'Starting as cluster manager')
    await runClusterManager(config)
  } else {
    logger.info({ role: 'bot-worker', cluster: process.env.CLUSTER }, 'Starting as bot worker')
    await runBotWorker(config)
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`)
  process.exit(1)
})
