import type * as sqliteSchema from './sqlite/schema.js'
import type * as pgSchema from './pg/schema.js'

// SQLite row types
export type SqliteGuildSettings = typeof sqliteSchema.guildSettings.$inferSelect
export type SqliteGuildSettingsInsert = typeof sqliteSchema.guildSettings.$inferInsert
export type SqliteChannelSettings = typeof sqliteSchema.channelSettings.$inferSelect
export type SqliteChannelSettingsInsert = typeof sqliteSchema.channelSettings.$inferInsert
export type SqliteUserSettings = typeof sqliteSchema.userSettings.$inferSelect
export type SqliteUserSettingsInsert = typeof sqliteSchema.userSettings.$inferInsert
export type SqliteSettingAuditLog = typeof sqliteSchema.settingAuditLog.$inferSelect
export type SqliteSettingAuditLogInsert = typeof sqliteSchema.settingAuditLog.$inferInsert
export type SqliteTtsMessageLog = typeof sqliteSchema.ttsMessageLog.$inferSelect
export type SqliteTtsMessageLogInsert = typeof sqliteSchema.ttsMessageLog.$inferInsert

// Postgres row types
export type PgGuildSettings = typeof pgSchema.guildSettings.$inferSelect
export type PgGuildSettingsInsert = typeof pgSchema.guildSettings.$inferInsert
export type PgChannelSettings = typeof pgSchema.channelSettings.$inferSelect
export type PgChannelSettingsInsert = typeof pgSchema.channelSettings.$inferInsert
export type PgUserSettings = typeof pgSchema.userSettings.$inferSelect
export type PgUserSettingsInsert = typeof pgSchema.userSettings.$inferInsert
export type PgSettingAuditLog = typeof pgSchema.settingAuditLog.$inferSelect
export type PgSettingAuditLogInsert = typeof pgSchema.settingAuditLog.$inferInsert
export type PgTtsMessageLog = typeof pgSchema.ttsMessageLog.$inferSelect
export type PgTtsMessageLogInsert = typeof pgSchema.ttsMessageLog.$inferInsert
