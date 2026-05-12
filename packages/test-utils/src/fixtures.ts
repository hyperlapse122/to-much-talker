// Seed helpers for test databases
// Full implementation deferred to Task 29 when Db types are available

export interface GuildSettingsSeed {
  guildId: string
  defaultModel?: string
  defaultVoice?: string | null
  maxChars?: number
  locale?: string
}

export interface ChannelSettingsSeed {
  guildId: string
  channelId: string
  queueStrategy?: string
  maxQueueSize?: number
}

export interface UserSettingsSeed {
  userId: string
  preferredModel?: string | null
  preferredVoice?: string | null
}

// These will accept a Db instance once packages/db is ready (Task 8)
// For now they're typed stubs to satisfy TypeScript in test files

export function makeGuildSettingsSeed(
  overrides: Partial<GuildSettingsSeed> = {},
): GuildSettingsSeed {
  return {
    guildId: '123456789012345678',
    defaultModel: 'google/gemini-3.1-flash-tts-preview',
    defaultVoice: null,
    maxChars: 500,
    locale: 'en',
    ...overrides,
  }
}

export function makeChannelSettingsSeed(
  overrides: Partial<ChannelSettingsSeed> = {},
): ChannelSettingsSeed {
  return {
    guildId: '123456789012345678',
    channelId: '123456789012345679',
    queueStrategy: 'drop-oldest',
    maxQueueSize: 20,
    ...overrides,
  }
}

export function makeUserSettingsSeed(overrides: Partial<UserSettingsSeed> = {}): UserSettingsSeed {
  return {
    userId: '123456789012345680',
    preferredModel: null,
    preferredVoice: null,
    ...overrides,
  }
}
