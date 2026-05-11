import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { getOrCreateQueueManager } from '../../queue/index.js'
import type { ProcessItemFn } from '../../queue/index.js'
import type { CommandContext } from '../context.js'

// Read-only access requires a processor, but `clear` must never trigger
// playback — this no-op satisfies the type contract without side effects.
const noopProcessor: ProcessItemFn = async () => {
  // intentionally empty: clear is a read-only queue operation
}

/**
 * `/tts clear` — Remove all queued TTS items for the current channel.
 *
 * Uses a no-op processor when fetching the manager so we never accidentally
 * start playback from a clear command.
 */
export async function handleTtsClear(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const log = ctx.logger.child({ component: 'commands/tts/clear' })

  const guild = interaction.guild
  const channelId = interaction.channelId
  if (guild === null) {
    await interaction.reply({
      content: 'This command must be used in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const manager = getOrCreateQueueManager(guild.id, noopProcessor)
  const cleared = manager.clear(channelId)

  log.info({ guildId: guild.id, channelId, count: cleared.length }, 'Queue cleared')

  // i18n: tts_clear_success
  await interaction.reply({ content: `Cleared ${cleared.length} items from the queue.` })
}
