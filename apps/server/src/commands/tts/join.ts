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
