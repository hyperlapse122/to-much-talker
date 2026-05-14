import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '../context.js'

const aiMocks = vi.hoisted(() => ({ synthesize: vi.fn() }))
const getVoiceConnection = vi.fn()
const playFromBuffer = vi.fn<() => Promise<void>>()
const audioBytesToOpus = vi.fn((input: Buffer) => Readable.from([input]))
const getGuildTtsRuntime = vi.fn()
const resolveTtsMessageSettings = vi.fn()
const resolveUserTtsPreset = vi.fn()

vi.mock('@discordjs/voice', () => ({ getVoiceConnection }))
vi.mock('@to-much-talker/ai', () => aiMocks)
vi.mock('../../voice/index.js', () => ({
  audioBytesToOpus,
  getOrCreatePlayer: vi.fn(() => ({
    attachConnection: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    playFromBuffer,
  })),
}))
vi.mock('./runtime-cache.js', () => ({
  getGuildTtsRuntime,
  resolveTtsMessageSettings,
  resolveUserTtsPreset,
}))

const { enqueueTtsText } = await import('./say.js')

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => undefined
}

function deferred<T>(): Deferred<T> {
  let resolveValue: ((value: T) => undefined) | undefined
  const promise = new Promise<T>((resolve) => {
    resolveValue = (value: T) => {
      resolve(value)
      return undefined
    }
  })
  if (resolveValue === undefined) {
    throw new Error('Deferred promise was not initialized')
  }
  return { promise, resolve: resolveValue }
}

function buildCtx(): CommandContext {
  const logger = {
    child: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
  }
  return { logger } as unknown as CommandContext
}

describe('enqueueTtsText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getVoiceConnection.mockReturnValue({})
    getGuildTtsRuntime.mockResolvedValue({ client: {}, defaultModel: 'model-a' })
    resolveTtsMessageSettings.mockResolvedValue({ maxChars: 100 })
    resolveUserTtsPreset.mockResolvedValue({ format: 'mp3', model: 'model-a', voice: 'voice-a' })
    aiMocks.synthesize.mockResolvedValue({
      ok: true,
      value: { audio: Buffer.from('audio'), format: 'mp3' },
    })
  })

  it('prefetches the next message while the current audio is still playing', async () => {
    const firstPlayback = deferred<undefined>()
    playFromBuffer.mockReturnValueOnce(firstPlayback.promise).mockResolvedValueOnce(undefined)

    await expect(
      enqueueTtsText(buildCtx(), {
        channelId: 'channel-1',
        guildId: 'guild-1',
        maxChars: 100,
        source: 'command',
        text: 'first',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({ accepted: true })
    await expect(
      enqueueTtsText(buildCtx(), {
        channelId: 'channel-1',
        guildId: 'guild-1',
        maxChars: 100,
        source: 'command',
        text: 'second',
        userId: 'user-2',
      }),
    ).resolves.toMatchObject({ accepted: true })

    await vi.waitFor(() => expect(aiMocks.synthesize).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(playFromBuffer).toHaveBeenCalledTimes(1))

    firstPlayback.resolve(undefined)
    await vi.waitFor(() => expect(playFromBuffer).toHaveBeenCalledTimes(2))
  })
})
