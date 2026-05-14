import { type MockInteraction, mockChatInputInteraction } from '@to-much-talker/test-utils'
import { ButtonStyle, MessageFlags, PermissionFlagsBits } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const GEMINI_MODEL = 'google/gemini-3.1-flash-tts-preview'
const OPENAI_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'

const runtimeCacheMocks = vi.hoisted(() => ({
  getGuildTtsModelSettings: vi.fn(),
  invalidateTtsRuntimeCache: vi.fn(),
}))

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

vi.mock('./commands/tts/runtime-cache.js', () => ({
  getGuildTtsModelSettings: runtimeCacheMocks.getGuildTtsModelSettings,
  invalidateTtsRuntimeCache: runtimeCacheMocks.invalidateTtsRuntimeCache,
}))

const { handleTtsJoin } = await import('./commands/tts/join.js')
const { handleTtsLeave } = await import('./commands/tts/leave.js')
const { buildTtsCommand } = await import('./bot/commands-registry.js')
const { handleTtsApiKeyModalSubmit, handleTtsSettings, handleTtsVoiceButton } =
  await import('./commands/tts/settings/index.js')
const { handleTtsSkip } = await import('./commands/tts/skip.js')
type CommandContext = import('./commands/context.js').CommandContext

interface CommandJsonOption {
  readonly name: string
  readonly options?: readonly CommandJsonOption[]
}

interface SmokeCtxHarness {
  readonly ctx: CommandContext
  readonly insertValues: unknown[]
  readonly invalidate: ReturnType<typeof vi.fn>
  readonly broadcastInvalidate: ReturnType<typeof vi.fn>
}

interface MockButtonInteraction {
  readonly customId: string
  readonly guildId: string | null
  readonly user: { readonly id: string }
  readonly reply: ReturnType<typeof vi.fn>
  readonly update: ReturnType<typeof vi.fn>
}

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
function buildCtxHarness(
  params: {
    readonly preferredVoice?: string
    readonly permissionsRoleId?: string | null
    readonly maxChars?: number | null
  } = {},
): SmokeCtxHarness {
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
  const insertValues: unknown[] = []
  const invalidate = vi.fn()
  const broadcastInvalidate = vi.fn().mockResolvedValue(undefined)
  const sqliteSelect = (selection?: Record<string, unknown>): unknown => ({
    from: () => ({
      where: () => ({
        get: () => {
          if (selection !== undefined && Object.hasOwn(selection, 'permissionsRoleId')) {
            return { permissionsRoleId: params.permissionsRoleId ?? null }
          }
          if (selection !== undefined && Object.hasOwn(selection, 'hasApiKey')) {
            return { hasApiKey: null }
          }
          return params
        },
      }),
    }),
  })
  const sqliteInsert = (): unknown => ({
    values: (value: unknown) => {
      insertValues.push(value)
      return {
        onConflictDoUpdate: () => ({ run: vi.fn() }),
        run: vi.fn(),
      }
    },
  })
  const ctx = {
    client: null,
    config: {
      MASTER_ENC_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      MASTER_ENC_KEY_VERSION: 1,
    },
    db: { dialect: 'sqlite', db: { select: sqliteSelect, insert: sqliteInsert } },
    settingsCache: { invalidate },
    ipcTransport: { broadcastInvalidate, onInvalidate: vi.fn() },
    logger,
  }
  return { ctx: ctx as unknown as CommandContext, insertValues, invalidate, broadcastInvalidate }
}

function buildCtx(
  params: { readonly preferredVoice?: string; readonly permissionsRoleId?: string | null } = {},
): CommandContext {
  return buildCtxHarness(params).ctx
}

function mockVoiceButtonInteraction(params: {
  readonly customId: string
  readonly guildId?: string | null
  readonly userId?: string
}): MockButtonInteraction {
  return {
    customId: params.customId,
    guildId: params.guildId ?? '123456789012345678',
    user: { id: params.userId ?? '123456789012345680' },
    reply: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }
}

function withRole(interaction: MockInteraction, roleId: string): MockInteraction {
  return Object.assign({}, interaction, {
    member: {
      permissions: interaction.member?.permissions,
      roles: { cache: new Map([[roleId, { id: roleId }]]) },
    },
  })
}

function withShowModal(
  interaction: MockInteraction,
): MockInteraction & { showModal: ReturnType<typeof vi.fn> } {
  return Object.assign({}, interaction, { showModal: vi.fn().mockResolvedValue(undefined) })
}

function mockApiKeyModalSubmit(params: {
  readonly guildId?: string
  readonly userId?: string
  readonly apiKey?: string
  readonly memberPermissions?: bigint
  readonly permissionsRoleId?: string
}): {
  readonly guildId: string
  readonly customId: string
  readonly user: { readonly id: string }
  readonly member:
    | { readonly permissions: { readonly has: (perm: bigint) => boolean } }
    | {
        readonly permissions: { readonly has: (perm: bigint) => boolean }
        readonly roles: { readonly cache: Map<string, { readonly id: string }> }
      }
  readonly fields: { readonly getTextInputValue: (customId: string) => string }
  readonly reply: ReturnType<typeof vi.fn>
  readonly editReply: ReturnType<typeof vi.fn>
  readonly deferred: false
  readonly replied: false
} {
  const memberPermissions = params.memberPermissions ?? 0n
  const member = params.permissionsRoleId
    ? {
        permissions: { has: (perm: bigint): boolean => (memberPermissions & perm) === perm },
        roles: { cache: new Map([[params.permissionsRoleId, { id: params.permissionsRoleId }]]) },
      }
    : { permissions: { has: (perm: bigint): boolean => (memberPermissions & perm) === perm } }

  return {
    guildId: params.guildId ?? '123456789012345678',
    customId: 'tts:settings:api-key',
    user: { id: params.userId ?? '123456789012345680' },
    member,
    fields: { getTextInputValue: () => params.apiKey ?? 'redacted-test-api-key' },
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false,
  }
}

describe('Bot smoke tests', () => {
  beforeEach(() => {
    runtimeCacheMocks.getGuildTtsModelSettings.mockReset()
    runtimeCacheMocks.getGuildTtsModelSettings.mockResolvedValue({
      defaultModel: GEMINI_MODEL,
      allowedModels: [GEMINI_MODEL, OPENAI_MODEL],
    })
    runtimeCacheMocks.invalidateTtsRuntimeCache.mockClear()
  })

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

  it('/tts user model replies with voice preset buttons', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommandGroup: 'user',
      subcommand: 'model',
      guildId: '123456789012345678',
    })

    await handleTtsSettings(base as never, buildCtx())

    const firstCallArg = base.reply.mock.calls[0]?.[0] as
      | {
          content?: string
          components?: { components?: { data?: { custom_id?: string; style?: number } }[] }[]
        }
      | undefined
    const row = firstCallArg?.components?.[0]
    const customIds = row?.components?.map((component) => component.data?.custom_id)
    const styles = row?.components?.map((component) => component.data?.style)

    expect(customIds).toEqual([
      'tts:user-voice:gemini-zephyr',
      'tts:user-voice:gemini-puck',
      'tts:user-voice:gemini-charon',
      'tts:user-voice:gemini-kore',
      'tts:user-voice:gemini-fenrir',
    ])
    expect(styles).toEqual([
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
    ])
    expect(firstCallArg?.content).toContain('Zephyr: Bright, clear, and upbeat.')
    expect(firstCallArg?.content).toContain('Alloy: Neutral, versatile, and natural.')
  })

  it('/tts user model filters voice presets by allowed runtime models', async () => {
    runtimeCacheMocks.getGuildTtsModelSettings.mockResolvedValueOnce({
      defaultModel: GEMINI_MODEL,
      allowedModels: [GEMINI_MODEL],
    })
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommandGroup: 'user',
      subcommand: 'model',
      guildId: '123456789012345678',
    })

    await handleTtsSettings(base as never, buildCtx())

    const firstCallArg = base.reply.mock.calls[0]?.[0] as
      | {
          content?: string
          components?: { components?: { data?: { custom_id?: string } }[] }[]
        }
      | undefined
    const customIds = firstCallArg?.components?.flatMap(
      (row) => row.components?.map((component) => component.data?.custom_id) ?? [],
    )

    expect(customIds).toContain('tts:user-voice:gemini-zephyr')
    expect(customIds).not.toContain('tts:user-voice:openai-alloy')
    expect(firstCallArg?.content).toContain('Zephyr: Bright, clear, and upbeat.')
    expect(firstCallArg?.content).not.toContain('Alloy: Neutral, versatile, and natural.')
  })

  it('/tts user model marks selected voice as primary', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommandGroup: 'user',
      subcommand: 'model',
      guildId: '123456789012345678',
    })

    await handleTtsSettings(base as never, buildCtx({ preferredVoice: 'Kore' }))

    const firstCallArg = base.reply.mock.calls[0]?.[0] as
      | {
          content?: string
          components?: { components?: { data?: { custom_id?: string; style?: number } }[] }[]
        }
      | undefined
    const row = firstCallArg?.components?.[0]
    const styles = row?.components?.map((component) => component.data?.style)

    expect(styles).toEqual([
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
      ButtonStyle.Secondary,
      ButtonStyle.Primary,
      ButtonStyle.Secondary,
    ])
    expect(firstCallArg?.content).toContain('Kore [selected]: Warm, smooth, and balanced.')
  })

  it('/tts voice button saves allowed selected voice', async () => {
    runtimeCacheMocks.getGuildTtsModelSettings.mockResolvedValueOnce({
      defaultModel: OPENAI_MODEL,
      allowedModels: [OPENAI_MODEL],
    })
    const harness = buildCtxHarness()
    const button = mockVoiceButtonInteraction({ customId: 'tts:user-voice:openai-alloy' })

    await handleTtsVoiceButton(button as never, harness.ctx)

    expect(button.reply).not.toHaveBeenCalled()
    expect(button.update).toHaveBeenCalledWith({
      content: 'Your preferred TTS voice is now Alloy.',
      components: [],
    })
    expect(JSON.stringify(harness.insertValues)).toContain(OPENAI_MODEL)
    expect(JSON.stringify(harness.insertValues)).toContain('alloy')
  })

  it('/tts voice button rejects disallowed selected voice without writing settings', async () => {
    runtimeCacheMocks.getGuildTtsModelSettings.mockResolvedValueOnce({
      defaultModel: GEMINI_MODEL,
      allowedModels: [GEMINI_MODEL],
    })
    const harness = buildCtxHarness()
    const button = mockVoiceButtonInteraction({ customId: 'tts:user-voice:openai-alloy' })

    await handleTtsVoiceButton(button as never, harness.ctx)

    expect(button.update).not.toHaveBeenCalled()
    expect(button.reply).toHaveBeenCalledWith({
      content: "The Alloy voice is not allowed by this server's TTS model settings.",
      flags: MessageFlags.Ephemeral,
    })
    expect(harness.insertValues).toEqual([])
  })

  it('/tts settings api-key rejects members without the configured settings role', async () => {
    const base = withShowModal(
      mockChatInputInteraction({
        commandName: 'tts',
        subcommandGroup: 'settings',
        subcommand: 'api-key',
        guildId: '123456789012345678',
      }),
    )
    const harness = buildCtxHarness({ permissionsRoleId: 'role-1' })

    await handleTtsSettings(base as never, harness.ctx)

    const firstCallArg = base.reply.mock.calls[0]?.[0] as { content?: string } | undefined
    expect(firstCallArg?.content).toContain('permission')
    expect(base.showModal).not.toHaveBeenCalled()
    expect(harness.insertValues).toEqual([])
  })

  it('/tts settings api-key command JSON does not collect a key option', () => {
    const command = buildTtsCommand().toJSON() as {
      readonly options?: readonly CommandJsonOption[]
    }
    const settingsGroup = command.options?.find((option) => option.name === 'settings')
    const apiKeyCommand = settingsGroup?.options?.find((option) => option.name === 'api-key')

    expect(apiKeyCommand?.options ?? []).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'key' })]),
    )
  })

  it('/tts settings max chars commands are registered under settings', () => {
    const command = buildTtsCommand().toJSON() as {
      readonly options?: readonly CommandJsonOption[]
    }
    const settingsGroup = command.options?.find((option) => option.name === 'settings')
    const serverMaxChars = settingsGroup?.options?.find(
      (option) => option.name === 'server-max-chars',
    )
    const channelMaxChars = settingsGroup?.options?.find(
      (option) => option.name === 'channel-max-chars',
    )

    expect(serverMaxChars?.options?.map((option) => option.name)).toEqual(['value', 'reset'])
    expect(channelMaxChars?.options?.map((option) => option.name)).toEqual(['value', 'reset'])
  })

  it('/tts settings server-max-chars writes an audit row and invalidates caches', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommandGroup: 'settings',
      subcommand: 'server-max-chars',
      guildId: '123456789012345678',
      memberPermissions: PermissionFlagsBits.ManageGuild,
      options: { value: 1200 },
    })
    const harness = buildCtxHarness({ maxChars: 500 })

    await handleTtsSettings(base as never, harness.ctx)

    expect(JSON.stringify(harness.insertValues)).toContain('1200')
    expect(JSON.stringify(harness.insertValues)).toContain('maxChars')
    expect(harness.invalidate).toHaveBeenCalledWith('123456789012345678')
    expect(harness.broadcastInvalidate).toHaveBeenCalledWith('123456789012345678')
  })

  it('/tts settings channel-max-chars rejects values above server ceiling', async () => {
    const base = mockChatInputInteraction({
      commandName: 'tts',
      subcommandGroup: 'settings',
      subcommand: 'channel-max-chars',
      guildId: '123456789012345678',
      memberPermissions: PermissionFlagsBits.ManageGuild,
      options: { value: 300 },
    })
    const harness = buildCtxHarness({ maxChars: 200 })

    await handleTtsSettings(base as never, harness.ctx)

    const firstCallArg = base.reply.mock.calls[0]?.[0] as { content?: string } | undefined
    expect(firstCallArg?.content).toContain('server limit of 200')
    expect(harness.insertValues).toEqual([])
  })

  it('/tts settings api-key shows a modal for members with the configured settings role', async () => {
    const base = withShowModal(
      withRole(
        mockChatInputInteraction({
          commandName: 'tts',
          subcommandGroup: 'settings',
          subcommand: 'api-key',
          guildId: '123456789012345678',
        }),
        'role-1',
      ),
    )

    await handleTtsSettings(base as never, buildCtx({ permissionsRoleId: 'role-1' }))

    expect(base.reply).not.toHaveBeenCalled()
    expect(base.showModal).toHaveBeenCalledTimes(1)
    const modal = base.showModal.mock.calls[0]?.[0] as { data?: { custom_id?: string } } | undefined
    expect(modal?.data?.custom_id).toBe('tts:settings:api-key')
  })

  it('/tts settings api-key shows a modal for ManageGuild bootstrap users', async () => {
    const base = withShowModal(
      mockChatInputInteraction({
        commandName: 'tts',
        subcommandGroup: 'settings',
        subcommand: 'api-key',
        guildId: '123456789012345678',
        memberPermissions: PermissionFlagsBits.ManageGuild,
      }),
    )

    await handleTtsSettings(base as never, buildCtx({ permissionsRoleId: null }))

    expect(base.reply).not.toHaveBeenCalled()
    expect(base.showModal).toHaveBeenCalledTimes(1)
  })

  it('/tts settings api-key modal stores redacted key and invalidates caches', async () => {
    const harness = buildCtxHarness({ permissionsRoleId: null })
    const modal = mockApiKeyModalSubmit({ memberPermissions: PermissionFlagsBits.Administrator })

    await handleTtsApiKeyModalSubmit(modal as never, harness.ctx)

    expect(modal.reply).toHaveBeenCalledWith({
      content: 'API key saved.',
      flags: MessageFlags.Ephemeral,
    })
    expect(harness.invalidate).toHaveBeenCalledWith('123456789012345678')
    expect(harness.broadcastInvalidate).toHaveBeenCalledWith('123456789012345678')
    expect(JSON.stringify(harness.insertValues)).not.toContain('redacted-test-api-key')
    expect(JSON.stringify(harness.insertValues)).toContain('api_key')
  })

  it('/tts settings api-key modal stores for members with the configured settings role', async () => {
    const harness = buildCtxHarness({ permissionsRoleId: 'role-1' })
    const modal = mockApiKeyModalSubmit({ permissionsRoleId: 'role-1' })

    await handleTtsApiKeyModalSubmit(modal as never, harness.ctx)

    expect(modal.reply).toHaveBeenCalledWith({
      content: 'API key saved.',
      flags: MessageFlags.Ephemeral,
    })
    expect(harness.insertValues.length).toBeGreaterThan(0)
    expect(JSON.stringify(harness.insertValues)).not.toContain('redacted-test-api-key')
  })
})
