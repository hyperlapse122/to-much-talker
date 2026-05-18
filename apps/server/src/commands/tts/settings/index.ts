import { encrypt, parseMasterKey } from '@to-much-talker/crypto'
import { and, eq, pg, sqlite } from '@to-much-talker/db'
import { m } from '@to-much-talker/i18n'
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import type { CommandContext } from '../../context.js'
import {
  getGuildTtsModelSettings,
  invalidateTtsRuntimeCache,
  type TtsRuntimeModelSettings,
} from '../runtime-cache.js'
import {
  findVoicePresetByButtonId,
  TTS_VOICE_BUTTON_PREFIX,
  TTS_VOICE_PRESETS,
  type TtsVoicePreset,
} from '../voice-presets.js'

export const TTS_VOICE_BUTTON_IDS = TTS_VOICE_PRESETS.map(
  (preset) => `${TTS_VOICE_BUTTON_PREFIX}${preset.id}`,
)

export const TTS_API_KEY_MODAL_CUSTOM_ID = 'tts:settings:api-key'
const TTS_API_KEY_MODAL_INPUT_ID = 'openrouter-api-key'
const MAX_CHARS_KEY = 'maxChars'
const MIN_TTS_MAX_CHARS = 1
const DEFAULT_TTS_MAX_CHARS = 500
const MAX_TTS_MAX_CHARS = 2000

function isTtsMaxCharsInRange(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_TTS_MAX_CHARS && value <= MAX_TTS_MAX_CHARS
}

interface ApiKeyState {
  readonly hasApiKey: boolean
}

interface EncryptedApiKey {
  readonly ciphertext: string
  readonly iv: string
  readonly authTag: string
  readonly version: number
}

type MaxCharsScope = 'server' | 'channel'

interface MaxCharsState {
  readonly maxChars: number | null
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

  if (group === 'settings' && subcommand === 'server-max-chars') {
    await handleMaxChars(interaction, ctx, 'server')
    return
  }

  if (group === 'settings' && subcommand === 'channel-max-chars') {
    await handleMaxChars(interaction, ctx, 'channel')
    return
  }

  if (group === 'user' && (subcommand === 'model' || subcommand === 'voice')) {
    await handleUserVoice(interaction, ctx)
    return
  }

  await interaction.reply({
    content: m.tts_settings_unknown_command(),
    flags: MessageFlags.Ephemeral,
  })
}

export async function handleTtsVoiceButton(
  interaction: ButtonInteraction,
  ctx: CommandContext,
): Promise<void> {
  const preset = findVoicePresetByButtonId(interaction.customId)
  if (preset === null) {
    await interaction.reply({
      content: m.tts_settings_unknown_voice_option(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: m.tts_settings_guild_only_user(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const modelSettings = await getGuildTtsModelSettings(ctx, guildId)
  if (!isVoicePresetAllowed(preset, modelSettings)) {
    await interaction.reply({
      content: m.tts_settings_voice_disallowed({ voice: preset.label }),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await saveUserVoice(ctx, guildId, interaction.user.id, preset)
  await interaction.update({
    content: m.tts_settings_voice_selected_success({ voice: preset.label }),
    components: [],
  })
}

export async function handleTtsApiKeyModalSubmit(
  interaction: ModalSubmitInteraction,
  ctx: CommandContext,
): Promise<void> {
  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: m.tts_settings_guild_only_server(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (!(await canUpdateServerSettings(interaction, ctx, guildId))) {
    await interaction.reply({
      content: m.tts_settings_api_key_unauthorized(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const apiKey = interaction.fields.getTextInputValue(TTS_API_KEY_MODAL_INPUT_ID)
  await saveApiKey(ctx, guildId, interaction.user.id, apiKey)

  await interaction.reply({
    content: m.tts_settings_api_key_success(),
    flags: MessageFlags.Ephemeral,
  })
}

async function handleUserVoice(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: m.tts_settings_guild_only_user(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const modelSettings = await getGuildTtsModelSettings(ctx, guildId)
  const voicePresets = allowedVoicePresets(modelSettings)
  const selectedVoice = await loadUserPreferredVoice(ctx, guildId, interaction.user.id)
  await interaction.reply({
    content: buildVoicePickerContent(selectedVoice, voicePresets),
    components: buildVoicePickerRows(selectedVoice, voicePresets),
    flags: MessageFlags.Ephemeral,
  })
}

async function handleMaxChars(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
  scope: MaxCharsScope,
): Promise<void> {
  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: m.tts_settings_guild_only_server(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (!(await canUpdateServerSettings(interaction, ctx, guildId))) {
    await interaction.reply({
      content: m.tts_settings_api_key_unauthorized(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const value = interaction.options.getInteger('value', false)
  const reset = interaction.options.getBoolean('reset', false) ?? false
  const channelId = interaction.channelId
  const serverMaxChars = await loadServerMaxChars(ctx, guildId)
  const serverLimit = serverMaxChars.maxChars ?? DEFAULT_TTS_MAX_CHARS

  if (value === null && !reset) {
    const current =
      scope === 'server' ? serverMaxChars : await loadChannelMaxChars(ctx, guildId, channelId)
    await interaction.reply({
      content: m.tts_settings_max_chars_current({
        scope,
        maxChars: current.maxChars ?? serverLimit,
      }),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (value !== null && !isTtsMaxCharsInRange(value)) {
    await interaction.reply({
      content: m.tts_settings_max_chars_invalid({
        min: MIN_TTS_MAX_CHARS,
        max: MAX_TTS_MAX_CHARS,
      }),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (scope === 'channel' && value !== null && value > serverLimit) {
    await interaction.reply({
      content: m.tts_settings_max_chars_above_server({ maxChars: serverLimit }),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await saveMaxChars(ctx, guildId, channelId, interaction.user.id, scope, reset ? null : value)
  await interaction.reply({
    content: reset
      ? m.tts_settings_reset_success({ key: MAX_CHARS_KEY })
      : m.tts_settings_server_set_success({ key: MAX_CHARS_KEY, value: String(value) }),
    flags: MessageFlags.Ephemeral,
  })
}

function buildVoicePickerContent(
  selectedVoice: string | null,
  voicePresets: readonly TtsVoicePreset[],
): string {
  const lines = voicePresets.map((preset) => {
    const marker =
      preset.voice === selectedVoice ? ` ${m.tts_settings_voice_selected_marker()}` : ''
    return `- ${m.tts_settings_voice_picker_option({
      label: preset.label,
      marker,
      description: preset.description(),
    })}`
  })
  return [m.tts_settings_voice_picker_header(), ...lines].join('\n')
}

function buildVoicePickerRows(
  selectedVoice: string | null,
  voicePresets: readonly TtsVoicePreset[],
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = []
  for (let index = 0; index < voicePresets.length; index += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        voicePresets.slice(index, index + 5).map((preset) =>
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

function allowedVoicePresets(modelSettings: TtsRuntimeModelSettings): readonly TtsVoicePreset[] {
  return TTS_VOICE_PRESETS.filter((preset) => isVoicePresetAllowed(preset, modelSettings))
}

function isVoicePresetAllowed(
  preset: TtsVoicePreset,
  modelSettings: TtsRuntimeModelSettings,
): boolean {
  return modelSettings.allowedModels.includes(preset.model)
}

async function loadUserPreferredVoice(
  ctx: CommandContext,
  guildId: string,
  userId: string,
): Promise<string | null> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ preferredVoice: sqlite.userSettings.preferredVoice })
      .from(sqlite.userSettings)
      .where(and(eq(sqlite.userSettings.guildId, guildId), eq(sqlite.userSettings.userId, userId)))
      .get()
    return row?.preferredVoice ?? null
  }

  const rows = await ctx.db.db
    .select({ preferredVoice: pg.userSettings.preferredVoice })
    .from(pg.userSettings)
    .where(and(eq(pg.userSettings.guildId, guildId), eq(pg.userSettings.userId, userId)))
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
    .where(and(eq(sqlite.userSettings.guildId, guildId), eq(sqlite.userSettings.userId, userId)))
    .get()

  db.insert(sqlite.userSettings)
    .values(userVoiceValues(guildId, userId, preset))
    .onConflictDoUpdate({
      target: [sqlite.userSettings.guildId, sqlite.userSettings.userId],
      set: {
        preferredModel: preset.model,
        preferredVoice: preset.voice,
        updatedAt: new Date(),
      },
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
    .where(and(eq(pg.userSettings.guildId, guildId), eq(pg.userSettings.userId, userId)))
    .limit(1)

  await db
    .insert(pg.userSettings)
    .values(userVoiceValues(guildId, userId, preset))
    .onConflictDoUpdate({
      target: [pg.userSettings.guildId, pg.userSettings.userId],
      set: {
        preferredModel: preset.model,
        preferredVoice: preset.voice,
        updatedAt: new Date(),
      },
    })

  await db.insert(pg.settingAuditLog).values(
    userVoiceAuditValues(
      guildId,
      userId,
      {
        model: rows[0]?.preferredModel ?? null,
        voice: rows[0]?.preferredVoice ?? null,
      },
      preset,
    ),
  )
}

function userVoiceValues(
  guildId: string,
  userId: string,
  preset: TtsVoicePreset,
): {
  readonly guildId: string
  readonly userId: string
  readonly preferredModel: string
  readonly preferredVoice: string
  readonly updatedAt: Date
} {
  return {
    guildId,
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
  readonly newValue: {
    readonly preferredModel: string
    readonly preferredVoice: string
  }
  readonly actorId: string
} {
  return {
    guildId,
    userId,
    scope: 'user',
    key: 'preferred_voice',
    oldValue: {
      preferredModel: previous.model,
      preferredVoice: previous.voice,
    },
    newValue: { preferredModel: preset.model, preferredVoice: preset.voice },
    actorId: userId,
  }
}

async function loadServerMaxChars(ctx: CommandContext, guildId: string): Promise<MaxCharsState> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ maxChars: sqlite.guildSettings.maxChars })
      .from(sqlite.guildSettings)
      .where(eq(sqlite.guildSettings.guildId, guildId))
      .get()
    return { maxChars: row?.maxChars ?? DEFAULT_TTS_MAX_CHARS }
  }

  const rows = await ctx.db.db
    .select({ maxChars: pg.guildSettings.maxChars })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)
  return { maxChars: rows[0]?.maxChars ?? DEFAULT_TTS_MAX_CHARS }
}

async function loadChannelMaxChars(
  ctx: CommandContext,
  guildId: string,
  channelId: string,
): Promise<MaxCharsState> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ maxChars: sqlite.channelSettings.maxChars })
      .from(sqlite.channelSettings)
      .where(
        and(
          eq(sqlite.channelSettings.guildId, guildId),
          eq(sqlite.channelSettings.channelId, channelId),
        ),
      )
      .get()
    return { maxChars: row?.maxChars ?? null }
  }

  const rows = await ctx.db.db
    .select({ maxChars: pg.channelSettings.maxChars })
    .from(pg.channelSettings)
    .where(
      and(eq(pg.channelSettings.guildId, guildId), eq(pg.channelSettings.channelId, channelId)),
    )
    .limit(1)
  return { maxChars: rows[0]?.maxChars ?? null }
}

async function saveMaxChars(
  ctx: CommandContext,
  guildId: string,
  channelId: string,
  actorId: string,
  scope: MaxCharsScope,
  value: number | null,
): Promise<void> {
  if (ctx.db.dialect === 'sqlite') {
    saveSqliteMaxChars(ctx.db.db, guildId, channelId, actorId, scope, value)
  } else {
    await savePgMaxChars(ctx.db.db, guildId, channelId, actorId, scope, value)
  }

  ctx.settingsCache.invalidate(guildId)
  invalidateTtsRuntimeCache(guildId)
  await ctx.ipcTransport.broadcastInvalidate(guildId)
}

function saveSqliteMaxChars(
  db: import('@to-much-talker/db').SqliteDb['db'],
  guildId: string,
  channelId: string,
  actorId: string,
  scope: MaxCharsScope,
  value: number | null,
): void {
  if (scope === 'server') {
    const previous = db
      .select({ maxChars: sqlite.guildSettings.maxChars })
      .from(sqlite.guildSettings)
      .where(eq(sqlite.guildSettings.guildId, guildId))
      .get()
    const nextValue = value ?? DEFAULT_TTS_MAX_CHARS
    db.insert(sqlite.guildSettings)
      .values({ guildId, maxChars: nextValue, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: sqlite.guildSettings.guildId,
        set: { maxChars: nextValue, updatedAt: new Date() },
      })
      .run()
    db.insert(sqlite.settingAuditLog)
      .values(
        maxCharsAuditValues(
          guildId,
          null,
          actorId,
          'server',
          previous?.maxChars ?? null,
          nextValue,
        ),
      )
      .run()
    return
  }

  const previous = db
    .select({ maxChars: sqlite.channelSettings.maxChars })
    .from(sqlite.channelSettings)
    .where(
      and(
        eq(sqlite.channelSettings.guildId, guildId),
        eq(sqlite.channelSettings.channelId, channelId),
      ),
    )
    .get()
  db.insert(sqlite.channelSettings)
    .values({ guildId, channelId, maxChars: value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [sqlite.channelSettings.guildId, sqlite.channelSettings.channelId],
      set: { maxChars: value, updatedAt: new Date() },
    })
    .run()
  db.insert(sqlite.settingAuditLog)
    .values(
      maxCharsAuditValues(
        guildId,
        channelId,
        actorId,
        'channel',
        previous?.maxChars ?? null,
        value,
      ),
    )
    .run()
}

async function savePgMaxChars(
  db: import('@to-much-talker/db').PgDb['db'],
  guildId: string,
  channelId: string,
  actorId: string,
  scope: MaxCharsScope,
  value: number | null,
): Promise<void> {
  if (scope === 'server') {
    const previousRows = await db
      .select({ maxChars: pg.guildSettings.maxChars })
      .from(pg.guildSettings)
      .where(eq(pg.guildSettings.guildId, guildId))
      .limit(1)
    const nextValue = value ?? DEFAULT_TTS_MAX_CHARS
    await db
      .insert(pg.guildSettings)
      .values({ guildId, maxChars: nextValue, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pg.guildSettings.guildId,
        set: { maxChars: nextValue, updatedAt: new Date() },
      })
    await db
      .insert(pg.settingAuditLog)
      .values(
        maxCharsAuditValues(
          guildId,
          null,
          actorId,
          'server',
          previousRows[0]?.maxChars ?? null,
          nextValue,
        ),
      )
    return
  }

  const previousRows = await db
    .select({ maxChars: pg.channelSettings.maxChars })
    .from(pg.channelSettings)
    .where(
      and(eq(pg.channelSettings.guildId, guildId), eq(pg.channelSettings.channelId, channelId)),
    )
    .limit(1)
  await db
    .insert(pg.channelSettings)
    .values({ guildId, channelId, maxChars: value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [pg.channelSettings.guildId, pg.channelSettings.channelId],
      set: { maxChars: value, updatedAt: new Date() },
    })
  await db
    .insert(pg.settingAuditLog)
    .values(
      maxCharsAuditValues(
        guildId,
        channelId,
        actorId,
        'channel',
        previousRows[0]?.maxChars ?? null,
        value,
      ),
    )
}

function maxCharsAuditValues(
  guildId: string,
  channelId: string | null,
  actorId: string,
  scope: MaxCharsScope,
  previous: number | null,
  next: number | null,
): {
  readonly guildId: string
  readonly channelId: string | null
  readonly scope: MaxCharsScope
  readonly key: string
  readonly oldValue: { readonly maxChars: number | null }
  readonly newValue: { readonly maxChars: number | null }
  readonly actorId: string
} {
  return {
    guildId,
    channelId,
    scope,
    key: MAX_CHARS_KEY,
    oldValue: { maxChars: previous },
    newValue: { maxChars: next },
    actorId,
  }
}

async function handleApiKey(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const guildId = interaction.guildId
  if (guildId === null) {
    await interaction.reply({
      content: m.tts_settings_guild_only_server(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (!(await canUpdateServerSettings(interaction, ctx, guildId))) {
    await interaction.reply({
      content: m.tts_settings_api_key_unauthorized(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.showModal(buildApiKeyModal())
}

function buildApiKeyModal(): ModalBuilder {
  const apiKeyInput = new TextInputBuilder()
    .setCustomId(TTS_API_KEY_MODAL_INPUT_ID)
    .setLabel(m.tts_settings_api_key_modal_label())
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)

  return new ModalBuilder()
    .setCustomId(TTS_API_KEY_MODAL_CUSTOM_ID)
    .setTitle(m.tts_settings_api_key_modal_title())
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(apiKeyInput))
}

async function canUpdateServerSettings(
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction,
  ctx: CommandContext,
  guildId: string,
): Promise<boolean> {
  const permissionsRoleId = await loadPermissionsRoleId(ctx, guildId)
  if (permissionsRoleId !== null) {
    return memberHasRole(interaction.member, permissionsRoleId)
  }

  return memberHasBootstrapPermission(interaction.member)
}

async function saveApiKey(
  ctx: CommandContext,
  guildId: string,
  actorId: string,
  apiKey: string,
): Promise<void> {
  const encrypted = encryptApiKey(apiKey, ctx)

  if (ctx.db.dialect === 'sqlite') {
    upsertSqliteApiKey(ctx.db.db, guildId, actorId, encrypted)
  } else {
    await upsertPgApiKey(ctx.db.db, guildId, actorId, encrypted)
  }

  ctx.settingsCache.invalidate(guildId)
  invalidateTtsRuntimeCache(guildId)
  await ctx.ipcTransport.broadcastInvalidate(guildId)
}

async function loadPermissionsRoleId(ctx: CommandContext, guildId: string): Promise<string | null> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ permissionsRoleId: sqlite.guildSettings.permissionsRoleId })
      .from(sqlite.guildSettings)
      .where(eq(sqlite.guildSettings.guildId, guildId))
      .get()
    return row?.permissionsRoleId ?? null
  }

  const rows = await ctx.db.db
    .select({ permissionsRoleId: pg.guildSettings.permissionsRoleId })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)
  return rows[0]?.permissionsRoleId ?? null
}

function memberHasRole(member: ChatInputCommandInteraction['member'], roleId: string): boolean {
  if (member === null || typeof member === 'string') return false
  if (!('roles' in member)) return false
  const { roles } = member
  return Array.isArray(roles) ? roles.includes(roleId) : roles.cache.has(roleId)
}

function memberHasBootstrapPermission(member: ChatInputCommandInteraction['member']): boolean {
  if (member === null || typeof member === 'string') return false
  if (!('permissions' in member)) return false
  const { permissions } = member
  if (typeof permissions === 'string') return false
  return (
    permissions.has(PermissionFlagsBits.ManageGuild) ||
    permissions.has(PermissionFlagsBits.Administrator)
  )
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
