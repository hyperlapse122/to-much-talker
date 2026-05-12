import { eq, pg, sqlite } from '@to-much-talker/db'
import { encrypt, parseMasterKey } from '@to-much-talker/crypto'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { CommandContext } from '../../context.js'
import { invalidateTtsRuntimeCache } from '../runtime-cache.js'

const GEMINI_TTS_MODEL = 'google/gemini-3.1-flash-tts-preview'
const GPT_4O_MINI_TTS_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'
const MODEL_CHOICES = {
  'tts:user-model:gemini': GEMINI_TTS_MODEL,
  'tts:user-model:gpt-4o-mini': GPT_4O_MINI_TTS_MODEL,
} as const

export const TTS_MODEL_BUTTON_IDS = Object.keys(MODEL_CHOICES) as (keyof typeof MODEL_CHOICES)[]

interface ApiKeyState {
  readonly hasApiKey: boolean
}

interface EncryptedApiKey {
  readonly ciphertext: string
  readonly iv: string
  readonly authTag: string
  readonly version: number
}

export async function handleTtsSettings(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false)
  const subcommand = interaction.options.getSubcommand(false)
  const log = ctx.logger.child({ component: 'commands/tts/settings' })

  log.debug({ group, subcommand }, 'Settings command invoked')

  if (group === 'settings' && subcommand === 'api-key') {
    await handleApiKey(interaction, ctx)
    return
  }

  if (group === 'user' && subcommand === 'model') {
    await handleUserModel(interaction, ctx)
    return
  }

  await interaction.reply({ content: 'Unknown settings command.', flags: MessageFlags.Ephemeral })
}

export async function handleTtsModelButton(
  interaction: ButtonInteraction,
  ctx: CommandContext,
): Promise<void> {
  const model = MODEL_CHOICES[interaction.customId as keyof typeof MODEL_CHOICES]
  if (model === undefined) {
    await interaction.reply({ content: 'Unknown TTS model option.', flags: MessageFlags.Ephemeral })
    return
  }

  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: 'User TTS settings can only be updated in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await saveUserModel(ctx, guildId, interaction.user.id, model)
  await interaction.update({
    content: `Your preferred TTS model is now ${displayModelName(model)}.`,
    components: [],
  })
}

async function handleUserModel(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  void ctx
  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: 'User TTS settings can only be updated in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.reply({
    content: 'Choose your preferred TTS model. You can only select one of these supported options.',
    components: [buildModelPickerRow()],
    flags: MessageFlags.Ephemeral,
  })
}

function buildModelPickerRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('tts:user-model:gemini')
      .setLabel('Gemini 3.1 Flash TTS')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tts:user-model:gpt-4o-mini')
      .setLabel('GPT-4o Mini TTS')
      .setStyle(ButtonStyle.Secondary),
  )
}

async function saveUserModel(
  ctx: CommandContext,
  guildId: string,
  userId: string,
  model: string,
): Promise<void> {
  if (ctx.db.dialect === 'sqlite') {
    upsertSqliteUserModel(ctx.db.db, guildId, userId, model)
  } else {
    await upsertPgUserModel(ctx.db.db, guildId, userId, model)
  }

  ctx.settingsCache.invalidate(guildId)
  await ctx.ipcTransport.broadcastInvalidate(guildId)
}

function displayModelName(model: string): string {
  if (model === GPT_4O_MINI_TTS_MODEL) return 'GPT-4o Mini TTS'
  return 'Gemini 3.1 Flash TTS'
}

function upsertSqliteUserModel(
  db: import('@to-much-talker/db').SqliteDb['db'],
  guildId: string,
  userId: string,
  model: string,
): void {
  const previous = db
    .select({ preferredModel: sqlite.userSettings.preferredModel })
    .from(sqlite.userSettings)
    .where(eq(sqlite.userSettings.userId, userId))
    .get()

  db.insert(sqlite.userSettings)
    .values(userModelValues(userId, model))
    .onConflictDoUpdate({
      target: sqlite.userSettings.userId,
      set: { preferredModel: model, updatedAt: new Date() },
    })
    .run()

  db.insert(sqlite.settingAuditLog)
    .values(userModelAuditValues(guildId, userId, previous?.preferredModel ?? null, model))
    .run()
}

async function upsertPgUserModel(
  db: import('@to-much-talker/db').PgDb['db'],
  guildId: string,
  userId: string,
  model: string,
): Promise<void> {
  const rows = await db
    .select({ preferredModel: pg.userSettings.preferredModel })
    .from(pg.userSettings)
    .where(eq(pg.userSettings.userId, userId))
    .limit(1)

  await db
    .insert(pg.userSettings)
    .values(userModelValues(userId, model))
    .onConflictDoUpdate({
      target: pg.userSettings.userId,
      set: { preferredModel: model, updatedAt: new Date() },
    })

  await db
    .insert(pg.settingAuditLog)
    .values(userModelAuditValues(guildId, userId, rows[0]?.preferredModel ?? null, model))
}

function userModelValues(userId: string, model: string) {
  return { userId, preferredModel: model, updatedAt: new Date() }
}

function userModelAuditValues(
  guildId: string,
  userId: string,
  previousModel: string | null,
  model: string,
) {
  return {
    guildId,
    userId,
    scope: 'user',
    key: 'preferred_model',
    oldValue: { preferredModel: previousModel },
    newValue: { preferredModel: model },
    actorId: userId,
  }
}

async function handleApiKey(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: 'Server settings can only be updated in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const apiKey = interaction.options.getString('key', true)
  const encrypted = encryptApiKey(apiKey, ctx)

  if (ctx.db.dialect === 'sqlite') {
    upsertSqliteApiKey(ctx.db.db, guildId, interaction.user.id, encrypted)
  } else {
    await upsertPgApiKey(ctx.db.db, guildId, interaction.user.id, encrypted)
  }

  ctx.settingsCache.invalidate(guildId)
  invalidateTtsRuntimeCache(guildId)
  await ctx.ipcTransport.broadcastInvalidate(guildId)

  await interaction.reply({
    content: 'OpenRouter API key saved for this server.',
    flags: MessageFlags.Ephemeral,
  })
}

function encryptApiKey(apiKey: string, ctx: CommandContext): EncryptedApiKey {
  const keyResult = parseMasterKey(ctx.config.MASTER_ENC_KEY)
  if (!keyResult.ok) {
    throw keyResult.error
  }

  const payload = encrypt(apiKey, keyResult.value)
  return {
    ciphertext: payload.ciphertext.toString('base64'),
    iv: payload.iv.toString('base64'),
    authTag: payload.authTag.toString('base64'),
    version: ctx.config.MASTER_ENC_KEY_VERSION,
  }
}

function upsertSqliteApiKey(
  db: import('@to-much-talker/db').SqliteDb['db'],
  guildId: string,
  actorId: string,
  encrypted: EncryptedApiKey,
): void {
  const previous = db
    .select({ hasApiKey: sqlite.guildSettings.apiKeyEncrypted })
    .from(sqlite.guildSettings)
    .where(eq(sqlite.guildSettings.guildId, guildId))
    .get()

  db.insert(sqlite.guildSettings)
    .values(apiKeyGuildSettingsValues(guildId, encrypted))
    .onConflictDoUpdate({
      target: sqlite.guildSettings.guildId,
      set: apiKeyGuildSettingsValues(guildId, encrypted),
    })
    .run()

  db.insert(sqlite.settingAuditLog)
    .values(
      apiKeyAuditValues(guildId, actorId, {
        hasApiKey: previous?.hasApiKey !== null && previous?.hasApiKey !== undefined,
      }),
    )
    .run()
}

async function upsertPgApiKey(
  db: import('@to-much-talker/db').PgDb['db'],
  guildId: string,
  actorId: string,
  encrypted: EncryptedApiKey,
): Promise<void> {
  const rows = await db
    .select({ hasApiKey: pg.guildSettings.apiKeyEncrypted })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)

  const previous = rows[0]

  await db
    .insert(pg.guildSettings)
    .values(apiKeyGuildSettingsValues(guildId, encrypted))
    .onConflictDoUpdate({
      target: pg.guildSettings.guildId,
      set: apiKeyGuildSettingsValues(guildId, encrypted),
    })

  await db.insert(pg.settingAuditLog).values(
    apiKeyAuditValues(guildId, actorId, {
      hasApiKey: previous?.hasApiKey !== null && previous?.hasApiKey !== undefined,
    }),
  )
}

function apiKeyGuildSettingsValues(guildId: string, encrypted: EncryptedApiKey) {
  return {
    guildId,
    apiKeyEncrypted: encrypted.ciphertext,
    apiKeyIv: encrypted.iv,
    apiKeyAuthTag: encrypted.authTag,
    apiKeyVersion: encrypted.version,
    updatedAt: new Date(),
  }
}

function apiKeyAuditValues(guildId: string, actorId: string, previous: ApiKeyState) {
  return {
    guildId,
    scope: 'server',
    key: 'api_key',
    oldValue: previous,
    newValue: { hasApiKey: true },
    actorId,
  }
}
