import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

export interface SqliteDb {
  readonly dialect: 'sqlite'
  readonly db: ReturnType<typeof drizzle<typeof schema>>
  readonly raw: InstanceType<typeof Database>
  close(): void
}

export function openSqlite(url: string): SqliteDb {
  const filePath = url.startsWith('sqlite://')
    ? url.slice('sqlite://'.length)
    : url.startsWith('file:')
      ? url.slice('file:'.length)
      : url

  if (filePath !== ':memory:') {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  const raw = new Database(filePath === ':memory:' ? ':memory:' : filePath)
  const db = drizzle(raw, { schema })

  return {
    dialect: 'sqlite',
    db,
    raw,
    close() {
      raw.close()
    },
  }
}
