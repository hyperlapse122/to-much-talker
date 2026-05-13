import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { migrate as pgMigrate } from 'drizzle-orm/postgres-js/migrator'
import type { Db } from './client.js'
import { isPg, isSqlite } from './client.js'

const currentDir = dirname(fileURLToPath(import.meta.url))

function resolveMigrationsDir(): string {
  const candidates = [
    join(currentDir, '..', 'migrations'),
    join(currentDir, '..', '..', 'migrations'),
    join(process.cwd(), 'migrations'),
    join(process.cwd(), 'packages', 'db', 'migrations'),
    join(process.cwd(), '..', '..', 'packages', 'db', 'migrations'),
  ]

  const match = candidates.find((candidate) =>
    existsSync(join(candidate, 'sqlite', 'meta', '_journal.json')),
  )

  if (match === undefined) {
    throw new Error('Could not locate database migrations directory')
  }

  return match
}

export async function runMigrations(db: Db): Promise<void> {
  if (isSqlite(db)) {
    const migrationsDir = resolveMigrationsDir()
    migrate(db.db, { migrationsFolder: join(migrationsDir, 'sqlite') })
    return
  }

  if (isPg(db)) {
    const migrationsDir = resolveMigrationsDir()
    await pgMigrate(db.db, { migrationsFolder: join(migrationsDir, 'pg') })
    return
  }

  const exhaustive: never = db
  throw new Error(`Unknown dialect: ${exhaustive}`)
}
