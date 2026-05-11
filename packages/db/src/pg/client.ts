import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export interface PgDb {
  readonly dialect: 'pg'
  readonly db: ReturnType<typeof drizzle<typeof schema>>
  readonly raw: ReturnType<typeof postgres>
  close(): Promise<void>
}

export function openPg(url: string): PgDb {
  const raw = postgres(url)
  const db = drizzle(raw, { schema })

  return {
    dialect: 'pg',
    db,
    raw,
    async close() {
      await raw.end()
    },
  }
}
