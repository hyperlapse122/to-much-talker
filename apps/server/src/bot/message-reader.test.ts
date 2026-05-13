import { EventEmitter } from 'node:events'
import type { Client, Message } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '../commands/context.js'

const getVoiceConnection = vi.fn()
const enqueueTtsText = vi.fn()

vi.mock('@discordjs/voice', () => ({ getVoiceConnection }))
vi.mock('../commands/tts/say.js', () => ({ enqueueTtsText }))

const { attachMessageReader } = await import('./message-reader.js')

function buildCtx(boundTextChannelId: string | null): CommandContext {
  const db = {
    dialect: 'sqlite',
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ get: () => ({ boundTextChannelId }) }),
        }),
      }),
    },
  }
  const logger = {
    child: () => ({ error: vi.fn() }),
  }
  return { db, logger } as unknown as CommandContext
}

function buildMessage(channelId: string): Message {
  return {
    author: { bot: false, id: 'user-1' },
    channelId,
    content: 'hello from chat',
    guildId: 'guild-1',
  } as unknown as Message
}

describe('message reader channel binding', () => {
  beforeEach(() => {
    getVoiceConnection.mockReset()
    enqueueTtsText.mockReset()
    enqueueTtsText.mockResolvedValue({ accepted: true })
  })

  it('queues messages from the text channel bound at join time', async () => {
    getVoiceConnection.mockReturnValue({ joinConfig: { channelId: 'voice-1' } })
    const emitter = new EventEmitter()
    attachMessageReader(emitter as Client, buildCtx('text-1'))

    emitter.emit('messageCreate', buildMessage('text-1'))
    await vi.waitFor(() => expect(enqueueTtsText).toHaveBeenCalledTimes(1))
  })

  it('ignores messages outside the bound text channel', async () => {
    getVoiceConnection.mockReturnValue({ joinConfig: { channelId: 'voice-1' } })
    const emitter = new EventEmitter()
    attachMessageReader(emitter as Client, buildCtx('text-1'))

    emitter.emit('messageCreate', buildMessage('text-2'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(enqueueTtsText).not.toHaveBeenCalled()
  })
})
