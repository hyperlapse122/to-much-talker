import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { leaveVoice, stopIdleWatcher } from '../../voice/index.js'
import type { CommandContext } from '../context.js'

/**
 * `/tts leave` — Disconnect the bot from its current voice channel.
 *
 * Stops any active idle watcher for the guild as well. Public reply so members
 * of the channel see the leave event.
 */
export async function handleTtsLeave(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const log = ctx.logger.child({ component: 'commands/tts/leave' })

  const guild = interaction.guild
  if (guild === null) {
    await interaction.reply({
      content: 'This command must be used in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  leaveVoice(guild.id)
  stopIdleWatcher(guild.id)

  log.info({ guildId: guild.id }, 'Left voice channel')

  // i18n: tts_leave_success
  await interaction.reply({ content: 'Left the voice channel.' })
}
