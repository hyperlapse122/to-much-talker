import { Events } from 'discord.js'
import type { Client, Message } from 'discord.js'
import type { CommandContext } from '../commands/context.js'
import { enqueueTtsText } from '../commands/tts/say.js'

export function attachMessageReader(client: Client, ctx: CommandContext): void {
  const log = ctx.logger.child({ component: 'message-reader' })

  client.on(Events.MessageCreate, (message) => {
    void handleMessage(message, ctx).catch((error: unknown) => {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to queue message for TTS',
      )
    })
  })
}

async function handleMessage(message: Message, ctx: CommandContext): Promise<void> {
  const receivedAtMs = performance.now()
  if (message.author.bot) return
  if (message.guildId === null) return
  if (message.content.trim().length === 0) return

  const result = await enqueueTtsText(ctx, {
    guildId: message.guildId,
    channelId: message.channelId,
    userId: message.author.id,
    text: message.content,
    source: 'message',
    receivedAtMs,
  })

  if (!result.accepted) return
}
