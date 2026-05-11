import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from '../context.js'

/**
 * `/tts setup` — Static onboarding wizard text.
 *
 * The wizard walks the admin through the four bootstrap steps. Always
 * ephemeral so onboarding noise doesn't leak to public channels.
 */
export async function handleTtsSetup(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  ctx.logger.child({ component: 'commands/tts/setup' }).debug('Setup wizard invoked')

  // Sanity-check that the invoker is a guild member (not an API stub object).
  const member = interaction.member
  if (member === null || typeof member === 'string') {
    await interaction.reply({
      content: 'Could not verify your permissions.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  // i18n: tts_setup_title + tts_setup_step_*
  await interaction.reply({
    content: [
      '**Server Setup Wizard**',
      '',
      '1. Set your OpenRouter API key: `/tts settings api-key`',
      '2. Choose allowed TTS models: `/tts settings server set allowed_models:...`',
      '3. Set default voice and model: `/tts settings server set default_model:...`',
      '4. Choose server language: `/tts settings server set locale:en`',
      '',
      'Your bot is ready to use! Use `/tts join` to start.',
    ].join('\n'),
    flags: MessageFlags.Ephemeral,
  })
}
