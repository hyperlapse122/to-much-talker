import { mockChatInputInteraction } from '@to-much-talker/test-utils'
import type { MockInteraction } from '@to-much-talker/test-utils'
import { describe, expect, it, vi } from 'vitest'

// Mock @discordjs/voice and the local voice/index.js wrapper to prevent
// loading the native @discordjs/opus binary in tests. Native module loads
// are not available in CI test environments.
vi.mock('@discordjs/voice', () => ({
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn(),
  joinVoiceChannel: vi.fn(),
  getVoiceConnection: vi.fn(() => undefined),
  entersState: vi.fn(),
  AudioPlayerStatus: { Idle: 'idle', Playing: 'playing', Paused: 'paused' },
  VoiceConnectionStatus: {
    Disconnected: 'disconnected',
    Signalling: 'signalling',
    Connecting: 'connecting',
  },
  StreamType: {
    Arbitrary: 'arbitrary',
    Opus: 'opus',
    OggOpus: 'ogg/opus',
    WebmOpus: 'webm/opus',
    Raw: 'raw',
  },
  NoSubscriberBehavior: { Pause: 'pause', Play: 'play', Stop: 'stop' },
}))

vi.mock('./voice/index.js', () => ({
  joinVoice: vi.fn(),
  leaveVoice: vi.fn(),
  stopIdleWatcher: vi.fn(),
  startIdleWatcher: vi.fn(),
  getIdleWatcher: vi.fn(() => undefined),
  getOrCreatePlayer: vi.fn(() => ({
    getState: (): string => 'idle',
    skip: vi.fn(),
    stop: vi.fn(),
    playFromBuffer: vi.fn(),
    attachConnection: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
  removePlayer: vi.fn(),
  IdleWatcher: vi.fn(),
  Player: vi.fn(),
}))

const { handleTtsJoin } = await import('./commands/tts/join.js')
const { handleTtsLeave } = await import('./commands/tts/leave.js')
const { handleTtsSettings } = await import('./commands/tts/settings/index.js')
const { handleTtsSkip } = await import('./commands/tts/skip.js')
type CommandContext = import('./commands/context.js').CommandContext

/**
 * Mock interaction extended with a `guild` property — the test-utils mock
 * only carries `guildId`, but command handlers read `interaction.guild`.
 */
function withGuild(
  interaction: MockInteraction,
  guildId: string,
): MockInteraction & { guild: { id: string } | null } {
  return Object.assign({}, interaction, { guild: { id: guildId } })
}

function withoutGuild(interaction: MockInteraction): MockInteraction & { guild: null } {
  return Object.assign({}, interaction, { guild: null })
}

/**
 * Minimal CommandContext stub — handlers only touch `logger.child(...)` in
 * the join/leave/skip code paths exercised here.
 */
function buildCtx(): CommandContext {
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
  const ctx = {
    client: null,
    config: null,
    db: null,
    settingsCache: null,
    ipcTransport: null,
    logger,
  }
  return ctx as unknown as CommandContext
}

describe('Bot smoke tests', () => {
  it('/tts join replies with error when user has no voice channel', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'join',
      guildId: '123456789012345678',
    })
    const i = withGuild(base, '123456789012345678')

    await handleTtsJoin(i as never, buildCtx())

    expect(base.reply.mock.calls.length).toBeGreaterThan(0)
    const firstCallArg = base.reply.mock.calls[0]?.[0] as { content?: string } | undefined
    expect(firstCallArg?.content).toBeDefined()
  })

  it('/tts join replies with guild error when interaction has no guild', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'join',
    })
    const i = withoutGuild(base)

    await handleTtsJoin(i as never, buildCtx())

    expect(base.reply.mock.calls.length).toBeGreaterThan(0)
  })

  it('/tts leave replies with success when no connection exists', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'leave',
      guildId: '123456789012345678',
    })
    const i = withGuild(base, '123456789012345678')

    await handleTtsLeave(i as never, buildCtx())

    expect(base.reply.mock.calls.length).toBeGreaterThan(0)
  })

  it('/tts leave replies with guild error when interaction has no guild', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'leave',
    })
    const i = withoutGuild(base)

    await handleTtsLeave(i as never, buildCtx())

    expect(base.reply.mock.calls.length).toBeGreaterThan(0)
  })

  it('/tts skip replies with "nothing playing" when player is idle', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'skip',
      guildId: '123456789012345670',
    })
    const i = withGuild(base, '123456789012345670')

    await handleTtsSkip(i as never, buildCtx())

    expect(base.reply.mock.calls.length).toBeGreaterThan(0)
    const firstCallArg = base.reply.mock.calls[0]?.[0] as { content?: string } | undefined
    expect(firstCallArg?.content).toContain('Nothing')
  })

  it('/tts skip replies with guild error when interaction has no guild', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommand: 'skip',
    })
    const i = withoutGuild(base)

    await handleTtsSkip(i as never, buildCtx())

    expect(base.reply.mock.calls.length).toBeGreaterThan(0)
  })

  it('/tts user model replies with fixed model buttons', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommandGroup: 'user',
      subcommand: 'model',
      guildId: '123456789012345678',
    })

    await handleTtsSettings(base as never, buildCtx())

    const firstCallArg = base.reply.mock.calls[0]?.[0] as
      | { components?: { components?: { data?: { custom_id?: string } }[] }[] }
      | undefined
    const row = firstCallArg?.components?.[0]
    const customIds = row?.components?.map((component) => component.data?.custom_id)

    expect(customIds).toEqual(['tts:user-model:gemini', 'tts:user-model:gpt-4o-mini'])
  })
})
