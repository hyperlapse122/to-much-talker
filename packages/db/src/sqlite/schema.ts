import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const guildSettings = sqliteTable('guild_settings', {
  guildId: text('guild_id').primaryKey(),
  apiKeyEncrypted: text('api_key_encrypted'),
  apiKeyIv: text('api_key_iv'),
  apiKeyAuthTag: text('api_key_auth_tag'),
  apiKeyVersion: integer('api_key_version'),
  allowedModels: text('allowed_models', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  defaultModel: text('default_model').notNull().default('google/gemini-2.5-flash-preview-tts'),
  defaultVoice: text('default_voice'),
  maxChars: integer('max_chars').notNull().default(500),
  maxPriceCents: integer('max_price_cents'),
  idleTextInactivityMs: integer('idle_text_inactivity_ms').notNull().default(300000),
  idleLeaveOnEmpty: integer('idle_leave_on_empty', { mode: 'boolean' }).notNull().default(true),
  permissionsRoleId: text('permissions_role_id'),
  locale: text('locale').notNull().default('en'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const channelSettings = sqliteTable(
  'channel_settings',
  {
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    maxChars: integer('max_chars'),
    maxQueueSize: integer('max_queue_size').notNull().default(20),
    queueStrategy: text('queue_strategy').notNull().default('drop-oldest'),
    queueStrategyParams: text('queue_strategy_params', { mode: 'json' }).$type<
      Record<string, unknown>
    >(),
    boundTextChannelId: text('bound_text_channel_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.channelId] }),
  }),
)

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id').primaryKey(),
  preferredModel: text('preferred_model'),
  preferredVoice: text('preferred_voice'),
  preferredLocale: text('preferred_locale'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const settingAuditLog = sqliteTable('setting_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id'),
  userId: text('user_id'),
  scope: text('scope').notNull(),
  key: text('key').notNull(),
  oldValue: text('old_value', { mode: 'json' }).$type<unknown>(),
  newValue: text('new_value', { mode: 'json' }).$type<unknown>(),
  actorId: text('actor_id').notNull(),
  ts: integer('ts', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const ttsMessageLog = sqliteTable('tts_message_log', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  userId: text('user_id').notNull(),
  model: text('model').notNull(),
  charCount: integer('char_count').notNull(),
  estCostMicros: integer('est_cost_micros').notNull(),
  actualCostMicros: integer('actual_cost_micros'),
  queuedAt: integer('queued_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  playedAt: integer('played_at', { mode: 'timestamp' }),
  error: text('error'),
})
