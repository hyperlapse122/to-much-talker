import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { migrate as pgMigrate } from 'drizzle-orm/postgres-js/migrator'
import type { Db } from './client.js'
import { isPg, isSqlite } from './client.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(currentDir, '..', '..', 'migrations')

export async function runMigrations(db: Db): Promise<void> {
  if (isSqlite(db)) {
    migrate(db.db, { migrationsFolder: join(migrationsDir, 'sqlite') })
    return
  }

  if (isPg(db)) {
    await pgMigrate(db.db, { migrationsFolder: join(migrationsDir, 'pg') })
    return
  }

  const exhaustive: never = db
  throw new Error(`Unknown dialect: ${exhaustive}`)
}
