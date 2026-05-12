import type { Result } from '@to-much-talker/shared'
import { ConfigError } from '@to-much-talker/shared'
import { detectDialect } from './dialect.js'
import { openPg } from './pg/client.js'
import type { PgDb } from './pg/client.js'
import { openSqlite } from './sqlite/client.js'
import type { SqliteDb } from './sqlite/client.js'

export type { PgDb } from './pg/client.js'
export type { SqliteDb } from './sqlite/client.js'

export type Db = SqliteDb | PgDb

export function isSqlite(db: Db): db is SqliteDb {
  return db.dialect === 'sqlite'
}

export function isPg(db: Db): db is PgDb {
  return db.dialect === 'pg'
}

export async function openDb(url: string): Promise<Result<Db, ConfigError>> {
  const dialectResult = detectDialect(url)
  if (!dialectResult.ok) {
    return dialectResult
  }

  try {
    if (dialectResult.value === 'sqlite') {
      return { ok: true, value: openSqlite(url) }
    }

    return { ok: true, value: openPg(url) }
  } catch (cause) {
    return {
      ok: false,
      error: new ConfigError(`Failed to open database at ${url}`, cause),
    }
  }
}
