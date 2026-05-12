import { eq, pg, sqlite } from '@to-much-talker/db'
import { encrypt, parseMasterKey } from '@to-much-talker/crypto'
import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from '../../context.js'

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

  await interaction.reply({ content: 'Unknown settings command.', flags: MessageFlags.Ephemeral })
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
