import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const guildSettings = pgTable('guild_settings', {
  guildId: text('guild_id').primaryKey(),
  apiKeyEncrypted: text('api_key_encrypted'),
  apiKeyIv: text('api_key_iv'),
  apiKeyAuthTag: text('api_key_auth_tag'),
  apiKeyVersion: integer('api_key_version'),
  allowedModels: jsonb('allowed_models').$type<string[]>().notNull().default([]),
  defaultModel: text('default_model').notNull().default('google/gemini-3.1-flash-tts-preview'),
  defaultVoice: text('default_voice'),
  maxChars: integer('max_chars').notNull().default(500),
  maxPriceCents: integer('max_price_cents'),
  idleTextInactivityMs: integer('idle_text_inactivity_ms').notNull().default(300000),
  idleLeaveOnEmpty: boolean('idle_leave_on_empty').notNull().default(true),
  permissionsRoleId: text('permissions_role_id'),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const channelSettings = pgTable(
  'channel_settings',
  {
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
    maxChars: integer('max_chars'),
    maxQueueSize: integer('max_queue_size').notNull().default(20),
    queueStrategy: text('queue_strategy').notNull().default('drop-oldest'),
    queueStrategyParams: jsonb('queue_strategy_params').$type<Record<string, unknown>>(),
    boundTextChannelId: text('bound_text_channel_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.channelId] }),
  }),
)

export const userSettings = pgTable(
  'user_settings',
  {
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    preferredModel: text('preferred_model'),
    preferredVoice: text('preferred_voice'),
    preferredLocale: text('preferred_locale'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.guildId, t.userId] }),
  }),
)

export const settingAuditLog = pgTable('setting_audit_log', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id'),
  userId: text('user_id'),
  scope: text('scope').notNull(),
  key: text('key').notNull(),
  oldValue: jsonb('old_value').$type<unknown>(),
  newValue: jsonb('new_value').$type<unknown>(),
  actorId: text('actor_id').notNull(),
  ts: timestamp('ts').notNull().defaultNow(),
})

export const ttsMessageLog = pgTable('tts_message_log', {
  id: text('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  channelId: text('channel_id').notNull(),
  userId: text('user_id').notNull(),
  model: text('model').notNull(),
  charCount: integer('char_count').notNull(),
  estCostMicros: bigint('est_cost_micros', { mode: 'number' }).notNull(),
  actualCostMicros: bigint('actual_cost_micros', { mode: 'number' }),
  queuedAt: timestamp('queued_at').notNull().defaultNow(),
  playedAt: timestamp('played_at'),
  error: text('error'),
})
