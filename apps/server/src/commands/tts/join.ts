import { eq, pg, sqlite } from '@to-much-talker/db'
import { ChannelType, MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { joinVoice } from '../../voice/index.js'
import type { CommandContext } from '../context.js'

/**
 * `/tts join` — Connect the bot to the user's current voice channel.
 *
 * Requires the user to be in a guild voice/stage channel. Replies ephemerally
 * on validation failure; replies publicly on success so the channel sees the join.
 */
export async function handleTtsJoin(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const log = ctx.logger.child({ component: 'commands/tts/join' })

  const guild = interaction.guild
  if (guild === null) {
    await interaction.reply({
      content: 'This command must be used in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const member = interaction.member
  if (
    member === null ||
    typeof member === 'string' ||
    !('voice' in member) ||
    member.voice === null ||
    member.voice.channel === null
  ) {
    // i18n: tts_join_no_voice
    await interaction.reply({
      content: 'You must be in a voice channel to use this command.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const voiceChannel = member.voice.channel
  if (
    voiceChannel.type !== ChannelType.GuildVoice &&
    voiceChannel.type !== ChannelType.GuildStageVoice
  ) {
    await interaction.reply({
      content: 'You must be in a regular voice channel.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  try {
    await joinVoice(guild, voiceChannel)
    await bindTextChannel(
      ctx,
      guild.id,
      voiceChannel.id,
      interaction.channelId,
      interaction.user.id,
    )

    log.info({ guildId: guild.id, channelId: voiceChannel.id }, 'Joined voice channel')

    // i18n: tts_join_success
    await interaction.reply({
      content: `Joined ${voiceChannel.name}! I'll read messages from this channel.`,
    })
  } catch (error) {
    log.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to join voice channel',
    )
    await interaction.reply({
      content: 'Failed to join voice channel. Check bot permissions.',
      flags: MessageFlags.Ephemeral,
    })
  }
}

async function bindTextChannel(
  ctx: CommandContext,
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  actorId: string,
): Promise<void> {
  if (ctx.db.dialect === 'sqlite') {
    bindSqliteTextChannel(ctx.db.db, guildId, voiceChannelId, textChannelId, actorId)
  } else {
    await bindPgTextChannel(ctx.db.db, guildId, voiceChannelId, textChannelId, actorId)
  }

  ctx.settingsCache.invalidate(guildId)
  await ctx.ipcTransport.broadcastInvalidate(guildId)
}

function bindSqliteTextChannel(
  db: import('@to-much-talker/db').SqliteDb['db'],
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  actorId: string,
): void {
  const previous = db
    .select({ boundTextChannelId: sqlite.channelSettings.boundTextChannelId })
    .from(sqlite.channelSettings)
    .where(eq(sqlite.channelSettings.channelId, voiceChannelId))
    .get()

  db.insert(sqlite.channelSettings)
    .values(boundTextChannelValues(guildId, voiceChannelId, textChannelId))
    .onConflictDoUpdate({
      target: [sqlite.channelSettings.guildId, sqlite.channelSettings.channelId],
      set: { boundTextChannelId: textChannelId, updatedAt: new Date() },
    })
    .run()

  db.insert(sqlite.settingAuditLog)
    .values(
      boundTextChannelAuditValues(
        guildId,
        voiceChannelId,
        actorId,
        previous?.boundTextChannelId ?? null,
        textChannelId,
      ),
    )
    .run()
}

async function bindPgTextChannel(
  db: import('@to-much-talker/db').PgDb['db'],
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  actorId: string,
): Promise<void> {
  const rows = await db
    .select({ boundTextChannelId: pg.channelSettings.boundTextChannelId })
    .from(pg.channelSettings)
    .where(eq(pg.channelSettings.channelId, voiceChannelId))
    .limit(1)

  await db
    .insert(pg.channelSettings)
    .values(boundTextChannelValues(guildId, voiceChannelId, textChannelId))
    .onConflictDoUpdate({
      target: [pg.channelSettings.guildId, pg.channelSettings.channelId],
      set: { boundTextChannelId: textChannelId, updatedAt: new Date() },
    })

  await db
    .insert(pg.settingAuditLog)
    .values(
      boundTextChannelAuditValues(
        guildId,
        voiceChannelId,
        actorId,
        rows[0]?.boundTextChannelId ?? null,
        textChannelId,
      ),
    )
}

function boundTextChannelValues(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
): {
  readonly guildId: string
  readonly channelId: string
  readonly boundTextChannelId: string
  readonly updatedAt: Date
} {
  return {
    guildId,
    channelId: voiceChannelId,
    boundTextChannelId: textChannelId,
    updatedAt: new Date(),
  }
}

function boundTextChannelAuditValues(
  guildId: string,
  voiceChannelId: string,
  actorId: string,
  oldValue: string | null,
  newValue: string,
): {
  readonly guildId: string
  readonly channelId: string
  readonly scope: 'channel'
  readonly key: 'bound_text_channel_id'
  readonly oldValue: string | null
  readonly newValue: string
  readonly actorId: string
} {
  return {
    guildId,
    channelId: voiceChannelId,
    scope: 'channel',
    key: 'bound_text_channel_id',
    oldValue,
    newValue,
    actorId,
  }
}
