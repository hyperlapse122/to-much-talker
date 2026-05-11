import { vi } from 'vitest'

// Minimal interface matching discord.js ChatInputCommandInteraction
// enough for our command handlers to work
export interface MockInteractionOptions {
  commandName?: string
  subcommand?: string
  guildId?: string
  channelId?: string
  userId?: string
  userLocale?: string
  memberPermissions?: bigint
  options?: Record<string, string | number | boolean | null>
}

export interface MockInteraction {
  readonly commandName: string
  readonly guildId: string | null
  readonly channelId: string | null
  readonly user: { id: string; locale: string }
  readonly member: { permissions: { has: (perm: bigint) => boolean } } | null
  readonly options: {
    getSubcommand: (required?: boolean) => string | null
    getString: (name: string, required?: boolean) => string | null
    getNumber: (name: string, required?: boolean) => number | null
    getBoolean: (name: string, required?: boolean) => boolean | null
  }
  // Mock fns — use vi.fn() for Vitest compatibility
  readonly reply: ReturnType<typeof vi.fn>
  readonly editReply: ReturnType<typeof vi.fn>
  readonly deferReply: ReturnType<typeof vi.fn>
  readonly followUp: ReturnType<typeof vi.fn>
  readonly deferred: boolean
  readonly replied: boolean
}

export function mockChatInputInteraction(opts: MockInteractionOptions = {}): MockInteraction {
  const resolved = {
    commandName: opts.commandName ?? 'tts',
    subcommand: opts.subcommand ?? null,
    guildId: opts.guildId ?? '123456789012345678',
    channelId: opts.channelId ?? '123456789012345679',
    userId: opts.userId ?? '123456789012345680',
    userLocale: opts.userLocale ?? 'en-US',
    memberPermissions: opts.memberPermissions ?? 0n,
    options: opts.options ?? {},
  }

  let deferred = false
  let replied = false

  const replyFn = vi.fn().mockImplementation(() => {
    replied = true
    return Promise.resolve()
  })
  const deferFn = vi.fn().mockImplementation(() => {
    deferred = true
    return Promise.resolve()
  })

  return {
    commandName: resolved.commandName,
    guildId: resolved.guildId,
    channelId: resolved.channelId,
    user: { id: resolved.userId, locale: resolved.userLocale },
    member: {
      permissions: {
        has: (perm: bigint): boolean => (resolved.memberPermissions & perm) === perm,
      },
    },
    options: {
      getSubcommand: (): string | null => resolved.subcommand,
      getString: (name: string): string | null => {
        const val = resolved.options[name]
        if (typeof val === 'string') return val
        return null
      },
      getNumber: (name: string): number | null => {
        const val = resolved.options[name]
        if (typeof val === 'number') return val
        return null
      },
      getBoolean: (name: string): boolean | null => {
        const val = resolved.options[name]
        if (typeof val === 'boolean') return val
        return null
      },
    },
    reply: replyFn,
    editReply: vi.fn().mockResolvedValue(undefined),
    deferReply: deferFn,
    followUp: vi.fn().mockResolvedValue(undefined),
    get deferred(): boolean {
      return deferred
    },
    get replied(): boolean {
      return replied
    },
  }
}

export function mockGuild(opts: { id?: string; name?: string; ownerId?: string } = {}): {
  id: string
  name: string
  ownerId: string
} {
  return {
    id: opts.id ?? '123456789012345678',
    name: opts.name ?? 'Test Server',
    ownerId: opts.ownerId ?? '123456789012345681',
  }
}

export function mockUser(opts: { id?: string; locale?: string; permissions?: bigint } = {}): {
  id: string
  locale: string
  permissions: bigint
} {
  return {
    id: opts.id ?? '123456789012345680',
    locale: opts.locale ?? 'en-US',
    permissions: opts.permissions ?? 0n,
  }
}

export function expectReply(
  interaction: MockInteraction,
  predicate?: (content: unknown) => boolean,
): void {
  const calls = interaction.reply.mock.calls
  if (calls.length === 0) {
    throw new Error('Expected interaction.reply() to have been called')
  }
  if (predicate !== undefined) {
    const lastCall = calls[calls.length - 1]
    if (lastCall === undefined || !predicate(lastCall[0])) {
      throw new Error(
        `reply() call did not satisfy predicate. Got: ${JSON.stringify(lastCall?.[0])}`,
      )
    }
  }
}
