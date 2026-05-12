import type { LocaleCode, QueueStrategyName } from '@to-much-talker/shared'
import { clampMax, coerceBoolean, intersectAllowlist } from './clamps.js'

const DEFAULT_MODEL = 'google/gemini-3.1-flash-tts-preview'
const DEFAULT_ALLOWED_MODELS = [DEFAULT_MODEL, 'google/gemini-3.1-flash-tts-preview'] as const

export interface SettingsInput {
  readonly server: Record<string, unknown> | null
  readonly channel: Record<string, unknown> | null
  readonly user: Record<string, unknown> | null
}

export interface ResolvedSettings {
  readonly maxChars: number
  readonly maxPriceCents: number | null
  readonly defaultModel: string
  readonly defaultVoice: string | null
  readonly queueStrategy: QueueStrategyName
  readonly maxQueueSize: number
  readonly locale: LocaleCode
  readonly idleTextInactivityMs: number
  readonly idleLeaveOnEmpty: boolean
  readonly allowedModels: readonly string[]
  readonly permissionsRoleId: string | null
  readonly boundTextChannelId: string | null
}

function getFromRow(row: Record<string, unknown> | null, key: string): unknown {
  if (row === null) return undefined
  return row[key]
}

function numberValue(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value
  return typeof value === 'number' ? value : undefined
}

function stringValue(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value
  return typeof value === 'string' ? value : undefined
}

function stringArrayValue(value: unknown): readonly string[] | null | undefined {
  if (value === null || value === undefined) return value
  if (!Array.isArray(value)) return undefined
  return value.every((item): item is string => typeof item === 'string') ? value : undefined
}

function queueStrategyValue(value: unknown): QueueStrategyName | undefined {
  return value === 'drop-oldest' || value === 'drop-newest' || value === 'interrupt'
    ? value
    : undefined
}

function localeValue(value: unknown): LocaleCode | undefined {
  return value === 'en' || value === 'ko' || value === 'ja' ? value : undefined
}

export function resolveSettings(input: SettingsInput): ResolvedSettings {
  const { server, channel, user } = input

  const serverMaxChars = numberValue(getFromRow(server, 'maxChars')) ?? 500
  const channelMaxChars = numberValue(getFromRow(channel, 'maxChars'))
  const resolvedMaxChars =
    clampMax(channelMaxChars ?? serverMaxChars, serverMaxChars) ?? serverMaxChars

  const serverDefaultModel = stringValue(getFromRow(server, 'defaultModel')) ?? DEFAULT_MODEL
  const serverAllowedModels =
    stringArrayValue(getFromRow(server, 'allowedModels')) ?? DEFAULT_ALLOWED_MODELS
  const userPreferredModel = stringValue(getFromRow(user, 'preferredModel'))
  const allowedModelsForOverride = serverAllowedModels.length > 0 ? serverAllowedModels : null
  const resolvedModel =
    intersectAllowlist(userPreferredModel, allowedModelsForOverride) ?? serverDefaultModel

  const serverDefaultVoice = stringValue(getFromRow(server, 'defaultVoice')) ?? null
  const userPreferredVoice = stringValue(getFromRow(user, 'preferredVoice'))
  const resolvedVoice = userPreferredVoice ?? serverDefaultVoice

  const serverLocale = localeValue(getFromRow(server, 'locale')) ?? 'en'
  const userLocale = localeValue(getFromRow(user, 'preferredLocale'))
  const resolvedLocale = userLocale ?? serverLocale

  const resolvedQueueStrategy =
    queueStrategyValue(getFromRow(channel, 'queueStrategy')) ?? 'drop-oldest'
  const resolvedMaxQueueSize = numberValue(getFromRow(channel, 'maxQueueSize')) ?? 20

  const resolvedMaxPriceCents = numberValue(getFromRow(server, 'maxPriceCents')) ?? null
  const resolvedIdleInactivityMs = numberValue(getFromRow(server, 'idleTextInactivityMs')) ?? 300000
  const resolvedIdleLeaveOnEmpty = coerceBoolean(
    getFromRow(server, 'idleLeaveOnEmpty') as boolean | number | null | undefined,
    true,
  )
  const resolvedPermissionsRoleId = stringValue(getFromRow(server, 'permissionsRoleId')) ?? null
  const resolvedBoundTextChannelId = stringValue(getFromRow(channel, 'boundTextChannelId')) ?? null

  return {
    maxChars: resolvedMaxChars,
    maxPriceCents: resolvedMaxPriceCents,
    defaultModel: resolvedModel,
    defaultVoice: resolvedVoice,
    queueStrategy: resolvedQueueStrategy,
    maxQueueSize: resolvedMaxQueueSize,
    locale: resolvedLocale,
    idleTextInactivityMs: resolvedIdleInactivityMs,
    idleLeaveOnEmpty: resolvedIdleLeaveOnEmpty,
    allowedModels: serverAllowedModels,
    permissionsRoleId: resolvedPermissionsRoleId,
    boundTextChannelId: resolvedBoundTextChannelId,
  }
}
