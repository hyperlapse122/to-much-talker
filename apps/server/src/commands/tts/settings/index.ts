import { encrypt, parseMasterKey } from '@to-much-talker/crypto'
import { eq, pg, sqlite } from '@to-much-talker/db'
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
import {
  TTS_VOICE_BUTTON_PREFIX,
  TTS_VOICE_PRESETS,
  findVoicePresetByButtonId,
  type TtsVoicePreset,
} from '../voice-presets.js'

export const TTS_VOICE_BUTTON_IDS = TTS_VOICE_PRESETS.map(
  (preset) => `${TTS_VOICE_BUTTON_PREFIX}${preset.id}`,
)

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

  if (group === 'user' && (subcommand === 'model' || subcommand === 'voice')) {
    await handleUserVoice(interaction, ctx)
    return
  }

  await interaction.reply({ content: 'Unknown settings command.', flags: MessageFlags.Ephemeral })
}

export async function handleTtsVoiceButton(
  interaction: ButtonInteraction,
  ctx: CommandContext,
): Promise<void> {
  const preset = findVoicePresetByButtonId(interaction.customId)
  if (preset === null) {
    await interaction.reply({ content: 'Unknown TTS voice option.', flags: MessageFlags.Ephemeral })
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

  await saveUserVoice(ctx, guildId, interaction.user.id, preset)
  await interaction.update({
    content: `Your preferred TTS voice is now ${preset.label}.`,
    components: [],
  })
}

async function handleUserVoice(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: 'User TTS settings can only be updated in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const selectedVoice = await loadUserPreferredVoice(ctx, interaction.user.id)
  await interaction.reply({
    content: buildVoicePickerContent(selectedVoice),
    components: buildVoicePickerRows(selectedVoice),
    flags: MessageFlags.Ephemeral,
  })
}

function buildVoicePickerContent(selectedVoice: string | null): string {
  const lines = TTS_VOICE_PRESETS.map((preset) => {
    const marker = preset.voice === selectedVoice ? ' [selected]' : ''
    return `- ${preset.label}${marker}: ${preset.description}`
  })
  return ['Choose your preferred TTS voice preset:', ...lines].join('\n')
}

function buildVoicePickerRows(
  selectedVoice: string | null,
): Array<ActionRowBuilder<ButtonBuilder>> {
  const rows: Array<ActionRowBuilder<ButtonBuilder>> = []
  for (let index = 0; index < TTS_VOICE_PRESETS.length; index += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        TTS_VOICE_PRESETS.slice(index, index + 5).map((preset) =>
          new ButtonBuilder()
            .setCustomId(`${TTS_VOICE_BUTTON_PREFIX}${preset.id}`)
            .setLabel(preset.label)
            .setStyle(preset.voice === selectedVoice ? ButtonStyle.Primary : ButtonStyle.Secondary),
        ),
      ),
    )
  }
  return rows
}

async function loadUserPreferredVoice(ctx: CommandContext, userId: string): Promise<string | null> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ preferredVoice: sqlite.userSettings.preferredVoice })
      .from(sqlite.userSettings)
      .where(eq(sqlite.userSettings.userId, userId))
      .get()
    return row?.preferredVoice ?? null
  }

  const rows = await ctx.db.db
    .select({ preferredVoice: pg.userSettings.preferredVoice })
    .from(pg.userSettings)
    .where(eq(pg.userSettings.userId, userId))
    .limit(1)
  return rows[0]?.preferredVoice ?? null
}

async function saveUserVoice(
  ctx: CommandContext,
  guildId: string,
  userId: string,
  preset: TtsVoicePreset,
): Promise<void> {
  if (ctx.db.dialect === 'sqlite') {
    upsertSqliteUserVoice(ctx.db.db, guildId, userId, preset)
  } else {
    await upsertPgUserVoice(ctx.db.db, guildId, userId, preset)
  }

  ctx.settingsCache.invalidate(guildId)
  invalidateTtsRuntimeCache(guildId)
  await ctx.ipcTransport.broadcastInvalidate(guildId)
}

function upsertSqliteUserVoice(
  db: import('@to-much-talker/db').SqliteDb['db'],
  guildId: string,
  userId: string,
  preset: TtsVoicePreset,
): void {
  const previous = db
    .select({
      preferredModel: sqlite.userSettings.preferredModel,
      preferredVoice: sqlite.userSettings.preferredVoice,
    })
    .from(sqlite.userSettings)
    .where(eq(sqlite.userSettings.userId, userId))
    .get()

  db.insert(sqlite.userSettings)
    .values(userVoiceValues(userId, preset))
    .onConflictDoUpdate({
      target: sqlite.userSettings.userId,
      set: { preferredModel: preset.model, preferredVoice: preset.voice, updatedAt: new Date() },
    })
    .run()

  db.insert(sqlite.settingAuditLog)
    .values(
      userVoiceAuditValues(
        guildId,
        userId,
        {
          model: previous?.preferredModel ?? null,
          voice: previous?.preferredVoice ?? null,
        },
        preset,
      ),
    )
    .run()
}

async function upsertPgUserVoice(
  db: import('@to-much-talker/db').PgDb['db'],
  guildId: string,
  userId: string,
  preset: TtsVoicePreset,
): Promise<void> {
  const rows = await db
    .select({
      preferredModel: pg.userSettings.preferredModel,
      preferredVoice: pg.userSettings.preferredVoice,
    })
    .from(pg.userSettings)
    .where(eq(pg.userSettings.userId, userId))
    .limit(1)

  await db
    .insert(pg.userSettings)
    .values(userVoiceValues(userId, preset))
    .onConflictDoUpdate({
      target: pg.userSettings.userId,
      set: { preferredModel: preset.model, preferredVoice: preset.voice, updatedAt: new Date() },
    })

  await db
    .insert(pg.settingAuditLog)
    .values(
      userVoiceAuditValues(
        guildId,
        userId,
        { model: rows[0]?.preferredModel ?? null, voice: rows[0]?.preferredVoice ?? null },
        preset,
      ),
    )
}

function userVoiceValues(
  userId: string,
  preset: TtsVoicePreset,
): {
  readonly userId: string
  readonly preferredModel: string
  readonly preferredVoice: string
  readonly updatedAt: Date
} {
  return {
    userId,
    preferredModel: preset.model,
    preferredVoice: preset.voice,
    updatedAt: new Date(),
  }
}

function userVoiceAuditValues(
  guildId: string,
  userId: string,
  previous: { readonly model: string | null; readonly voice: string | null },
  preset: TtsVoicePreset,
): {
  readonly guildId: string
  readonly userId: string
  readonly scope: 'user'
  readonly key: 'preferred_voice'
  readonly oldValue: {
    readonly preferredModel: string | null
    readonly preferredVoice: string | null
  }
  readonly newValue: { readonly preferredModel: string; readonly preferredVoice: string }
  readonly actorId: string
} {
  return {
    guildId,
    userId,
    scope: 'user',
    key: 'preferred_voice',
    oldValue: { preferredModel: previous.model, preferredVoice: previous.voice },
    newValue: { preferredModel: preset.model, preferredVoice: preset.voice },
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
