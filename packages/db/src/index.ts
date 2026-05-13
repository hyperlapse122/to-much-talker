// Re-export common drizzle-orm operators so consumers don't need a direct
// drizzle-orm dependency for simple query construction.
export { and, eq, isNotNull } from 'drizzle-orm'
export type { Db, PgDb, SqliteDb } from './client.js'
export { isPg, isSqlite, openDb } from './client.js'
export type { Dialect } from './dialect.js'
export { detectDialect } from './dialect.js'
export { runMigrations } from './migrate.js'
export * as pg from './pg/schema.js'
export * as sqlite from './sqlite/schema.js'
export type * from './types.js'
