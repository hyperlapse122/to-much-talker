import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from '../context.js'

/**
 * `/tts help` — Static help text listing every available subcommand.
 *
 * Always ephemeral so the user can dismiss the message without clutter.
 */
export async function handleTtsHelp(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  ctx.logger.child({ component: 'commands/tts/help' }).debug('Help invoked')

  // i18n: tts_help_title + per-command keys
  const helpText = [
    '**To Much Talker — TTS Bot Help**',
    '',
    '`/tts join` — Join your voice channel and start reading messages',
    '`/tts leave` — Leave the voice channel',
    '`/tts say <text>` — Queue a text-to-speech message',
    '`/tts skip` — Skip the current TTS track',
    '`/tts clear` — Clear the TTS queue',
    '`/tts stats` — Show queue statistics',
    '`/tts settings` — View and update settings',
    '`/tts setup` — Run the server setup wizard',
    '',
    'For full documentation, visit the docs site.',
  ].join('\n')

  await interaction.reply({ content: helpText, flags: MessageFlags.Ephemeral })
}
