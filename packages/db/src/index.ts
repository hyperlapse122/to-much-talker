export * as sqlite from './sqlite/schema.js'
export * as pg from './pg/schema.js'
export type * from './types.js'
export type { Dialect } from './dialect.js'
export { detectDialect } from './dialect.js'
export type { Db, PgDb, SqliteDb } from './client.js'
export { isPg, isSqlite, openDb } from './client.js'
export { runMigrations } from './migrate.js'
// Re-export common drizzle-orm operators so consumers don't need a direct
// drizzle-orm dependency for simple query construction.
export { eq, isNotNull } from 'drizzle-orm'
