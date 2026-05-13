import { EventEmitter } from 'node:events'
import type { Client, Message } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '../commands/context.js'

const getVoiceConnection = vi.fn()
const enqueueTtsText = vi.fn()
const eq = vi.fn((column: unknown, value: string) => ({ kind: 'eq', column, value }))
const and = vi.fn((...clauses: unknown[]) => ({ kind: 'and', clauses }))

const sqliteChannelSettings = {
  guildId: { name: 'sqlite.guildId' },
  channelId: { name: 'sqlite.channelId' },
  boundTextChannelId: { name: 'sqlite.boundTextChannelId' },
}

const pgChannelSettings = {
  guildId: { name: 'pg.guildId' },
  channelId: { name: 'pg.channelId' },
  boundTextChannelId: { name: 'pg.boundTextChannelId' },
}

vi.mock('@to-much-talker/db', () => ({
  eq,
  pg: { channelSettings: pgChannelSettings },
  sqlite: { channelSettings: sqliteChannelSettings },
}))
vi.mock('@discordjs/voice', () => ({ getVoiceConnection }))
vi.mock('drizzle-orm', () => ({ and }))
vi.mock('../commands/tts/say.js', () => ({ enqueueTtsText }))

const { attachMessageReader } = await import('./message-reader.js')

interface BindingRow {
  guildId: string
  channelId: string
  boundTextChannelId: string | null
}

function matchesBinding(condition: unknown, row: BindingRow): boolean {
  const clauses =
    condition !== null && typeof condition === 'object' && 'clauses' in condition
      ? (condition as { clauses: unknown[] }).clauses
      : [condition]

  const channelClause = clauses.find(
    (clause) =>
      clause !== null &&
      typeof clause === 'object' &&
      'column' in clause &&
      (clause as { column: unknown }).column === sqliteChannelSettings.channelId,
  ) as { value?: string } | undefined
  if (channelClause?.value !== row.channelId) return false

  const guildClause = clauses.find(
    (clause) =>
      clause !== null &&
      typeof clause === 'object' &&
      'column' in clause &&
      (clause as { column: unknown }).column === sqliteChannelSettings.guildId,
  ) as { value?: string } | undefined
  return guildClause === undefined || guildClause.value === row.guildId
}

function buildCtx(row: BindingRow): CommandContext {
  const db = {
    dialect: 'sqlite',
    db: {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => ({
            get: () =>
              matchesBinding(condition, row)
                ? { boundTextChannelId: row.boundTextChannelId }
                : undefined,
            limit: () =>
              matchesBinding(condition, row)
                ? [{ boundTextChannelId: row.boundTextChannelId }]
                : [],
          }),
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
    attachMessageReader(
      emitter as Client,
      buildCtx({ guildId: 'guild-1', channelId: 'voice-1', boundTextChannelId: 'text-1' }),
    )

    emitter.emit('messageCreate', buildMessage('text-1'))
    await vi.waitFor(() => expect(enqueueTtsText).toHaveBeenCalledTimes(1))
  })

  it('ignores messages outside the bound text channel', async () => {
    getVoiceConnection.mockReturnValue({ joinConfig: { channelId: 'voice-1' } })
    const emitter = new EventEmitter()
    attachMessageReader(
      emitter as Client,
      buildCtx({ guildId: 'guild-1', channelId: 'voice-1', boundTextChannelId: 'text-1' }),
    )

    emitter.emit('messageCreate', buildMessage('text-2'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(enqueueTtsText).not.toHaveBeenCalled()
  })

  it('ignores bindings from another guild', async () => {
    getVoiceConnection.mockReturnValue({ joinConfig: { channelId: 'voice-1' } })
    const emitter = new EventEmitter()
    attachMessageReader(
      emitter as Client,
      buildCtx({ guildId: 'guild-2', channelId: 'voice-1', boundTextChannelId: 'text-1' }),
    )

    emitter.emit('messageCreate', buildMessage('text-1'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(enqueueTtsText).not.toHaveBeenCalled()
  })
})
