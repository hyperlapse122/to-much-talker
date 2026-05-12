export type QueueStrategyName = 'drop-oldest' | 'drop-newest' | 'interrupt'

export type LocaleCode = 'en' | 'ko' | 'ja'

export type Scope = 'server' | 'channel' | 'user'

export interface GuildSettingsRow {
  guildId: string
  defaultModel: string
  defaultVoice: string | null
  maxChars: number
  locale: LocaleCode
}

export interface ChannelSettingsRow {
  guildId: string
  channelId: string
  queueStrategy: QueueStrategyName
  maxQueueSize: number
  boundTextChannelId: string | null
}
