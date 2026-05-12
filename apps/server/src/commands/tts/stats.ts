import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { getOrCreateQueueManager } from '../../queue/index.js'
import type { ProcessItemFn } from '../../queue/index.js'
import type { CommandContext } from '../context.js'

// stats is a read-only operation but the manager requires a processor for
// its constructor — this no-op satisfies the contract without side effects.
const noopProcessor: ProcessItemFn = async () => {
  // intentionally empty: stats is a read-only queue operation
}

/**
 * `/tts stats` — Display queue and runtime statistics for the current channel.
 *
 * Always replies ephemerally (stats are noise in public channels).
 */
export async function handleTtsStats(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const log = ctx.logger.child({ component: 'commands/tts/stats' })

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
  const queueSize = manager.size(channelId)

  log.debug({ guildId: guild.id, channelId, queueSize }, 'Stats reported')

  // i18n: tts_stats_header, tts_stats_queue_size
  await interaction.reply({
    content: ['**TTS Stats**', `Queue size: ${queueSize}`].join('\n'),
    flags: MessageFlags.Ephemeral,
  })
}
