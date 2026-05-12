import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { getOrCreatePlayer } from '../../voice/index.js'
import type { CommandContext } from '../context.js'

/**
 * `/tts skip` — Skip the currently-playing TTS track for this guild.
 *
 * Only meaningful when the audio player is in `playing` or `paused` state.
 */
export async function handleTtsSkip(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const log = ctx.logger.child({ component: 'commands/tts/skip' })

  const guild = interaction.guild
  if (guild === null) {
    await interaction.reply({
      content: 'This command must be used in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const player = getOrCreatePlayer(guild.id)
  const state = player.getState()

  if (state !== 'playing' && state !== 'paused') {
    // i18n: tts_skip_nothing
    await interaction.reply({
      content: 'Nothing is currently playing.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  player.skip()
  log.info({ guildId: guild.id }, 'Skipped current track')

  // i18n: tts_skip_success
  await interaction.reply({ content: 'Skipped the current track.' })
}
