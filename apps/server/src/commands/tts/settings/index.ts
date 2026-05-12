import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from '../../context.js'

/**
 * `/tts settings` — Top-level dispatcher for the settings subcommand group.
 *
 * Currently a stub that reports the invoked subcommand; the full implementation
 * (server/channel/user get/set/reset/audit) lands in a later task.
 */
export async function handleTtsSettings(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const log = ctx.logger.child({ component: 'commands/tts/settings' })

  const subcommand = interaction.options.getSubcommand(false)

  log.debug({ subcommand }, 'Settings command invoked')

  await interaction.reply({
    content: `Settings command: ${subcommand ?? 'unknown'}. Full implementation coming soon.`,
    flags: MessageFlags.Ephemeral,
  })
}
