import { type MockInteraction, mockChatInputInteraction } from '@to-much-talker/test-utils'
import { ChannelType, MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../voice/index.js', () => ({
  joinVoice: vi.fn(),
  leaveVoice: vi.fn(),
}))

const { handleTtsJoin } = await import('./join.js')
const voice = await import('../../voice/index.js')
const joinVoice = vi.mocked(voice.joinVoice)
const leaveVoice = vi.mocked(voice.leaveVoice)

type CommandContext = import('../context.js').CommandContext
function withGuildVoice(
  interaction: MockInteraction,
  guildId: string,
  voiceChannel: { readonly id: string; readonly name: string; readonly type: ChannelType },
): MockInteraction & {
  guild: { id: string }
  member: NonNullable<MockInteraction['member']> & {
    voice: { channel: { readonly id: string; readonly name: string; readonly type: ChannelType } }
  }
} {
  return Object.assign({}, interaction, {
    guild: { id: guildId },
    member: {
      ...interaction.member,
      voice: { channel: voiceChannel },
    },
  })
}

function buildCtx(failBind = false): {
  ctx: CommandContext
  childLogger: {
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    debug: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    trace: ReturnType<typeof vi.fn>
    fatal: ReturnType<typeof vi.fn>
    child: () => unknown
  }
  settingsCache: { invalidate: ReturnType<typeof vi.fn> }
  ipcTransport: { broadcastInvalidate: ReturnType<typeof vi.fn> }
} {
  const childLogger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: (): unknown => childLogger,
  }
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: (): unknown => childLogger,
  }
  const settingsCache = { invalidate: vi.fn() }
  const ipcTransport = { broadcastInvalidate: vi.fn().mockResolvedValue(undefined) }
  const previous = { boundTextChannelId: null }
  const run = vi.fn()
  if (failBind) {
    run.mockImplementation(() => {
      throw new Error('bind failed')
    })
  }
  const insertResult = {
    run,
    onConflictDoUpdate: vi.fn(() => insertResult),
  }
  const ctx = {
    client: null,
    config: null,
    db: {
      dialect: 'sqlite' as const,
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              get: () => previous,
            }),
          }),
        }),
        insert: vi.fn(() => ({
          values: () => insertResult,
        })),
      },
    },
    settingsCache,
    ipcTransport,
    logger,
  }

  return { ctx: ctx as unknown as CommandContext, childLogger, settingsCache, ipcTransport }
}

function hasJoinedReply(calls: readonly (readonly unknown[])[]): boolean {
  return calls.some(([arg]) => {
    if (typeof arg !== 'object' || arg === null) {
      return false
    }

    const payload = arg as { content?: string }
    return payload.content?.startsWith('Joined ') === true
  })
}

beforeEach(() => {
  joinVoice.mockReset()
  leaveVoice.mockReset()
})

describe('/tts join', () => {
  it('rolls back the voice connection when text binding fails', async () => {
    joinVoice.mockResolvedValueOnce(undefined as unknown as Awaited<ReturnType<typeof joinVoice>>)

    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'join',
      guildId: '123456789012345678',
    })
    const interaction = withGuildVoice(base, '123456789012345678', {
      id: '123456789012345679',
      name: 'General',
      type: ChannelType.GuildVoice,
    })
    const { ctx, childLogger } = buildCtx(true)

    await handleTtsJoin(interaction as never, ctx)

    expect(joinVoice).toHaveBeenCalledTimes(1)
    expect(leaveVoice).toHaveBeenCalledWith('123456789012345678')
    expect(childLogger.error).toHaveBeenCalled()
    expect(hasJoinedReply(base.reply.mock.calls)).toBe(false)
    expect(base.reply.mock.calls[0]?.[0]).toMatchObject({
      content: 'Failed to join voice channel. Check bot permissions.',
      flags: MessageFlags.Ephemeral,
    })
  })

  it('keeps the voice connection when text binding succeeds', async () => {
    joinVoice.mockResolvedValueOnce(undefined as unknown as Awaited<ReturnType<typeof joinVoice>>)

    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'join',
      guildId: '123456789012345679',
    })
    const interaction = withGuildVoice(base, '123456789012345679', {
      id: '123456789012345680',
      name: 'Stage',
      type: ChannelType.GuildStageVoice,
    })
    const { ctx, settingsCache, ipcTransport } = buildCtx()

    await handleTtsJoin(interaction as never, ctx)

    expect(joinVoice).toHaveBeenCalledTimes(1)
    expect(leaveVoice).not.toHaveBeenCalled()
    expect(settingsCache.invalidate).toHaveBeenCalledWith('123456789012345679')
    expect(ipcTransport.broadcastInvalidate).toHaveBeenCalledWith('123456789012345679')
    expect(hasJoinedReply(base.reply.mock.calls)).toBe(true)
  })
})
