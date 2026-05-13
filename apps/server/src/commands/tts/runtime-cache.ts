import { OpenRouterClient } from '@to-much-talker/ai'
import { decrypt, KeyRing, parseMasterKey } from '@to-much-talker/crypto'
import { and, eq, pg, sqlite } from '@to-much-talker/db'
import type { CommandContext } from '../context.js'
import {
  defaultVoicePresetForModel,
  findVoicePresetByVoice,
  type TtsVoicePreset,
} from './voice-presets.js'

const DEFAULT_MODEL = 'google/gemini-3.1-flash-tts-preview'
const SUPPORTED_TTS_MODELS = [DEFAULT_MODEL, 'openai/gpt-4o-mini-tts-2025-12-15'] as const
type SupportedTtsModel = (typeof SUPPORTED_TTS_MODELS)[number]

interface StoredApiKey {
  readonly encrypted: string
  readonly iv: string
  readonly authTag: string
  readonly version: number
}

export interface TtsRuntimeConfig {
  readonly client: OpenRouterClient
  readonly defaultModel: string
  readonly allowedModels: readonly string[]
}

export type TtsRuntimeModelSettings = Pick<TtsRuntimeConfig, 'defaultModel' | 'allowedModels'>

const runtimeCache = new Map<string, Promise<TtsRuntimeConfig | null>>()

export function invalidateTtsRuntimeCache(guildId: string): void {
  runtimeCache.delete(guildId)
}

export async function getGuildTtsRuntime(
  ctx: CommandContext,
  guildId: string,
): Promise<TtsRuntimeConfig | null> {
  const cached = runtimeCache.get(guildId)
  if (cached !== undefined) return cached

  const runtime = loadGuildTtsRuntime(ctx, guildId).catch((error: unknown) => {
    runtimeCache.delete(guildId)
    throw error
  })
  runtimeCache.set(guildId, runtime)
  return runtime
}

export async function getGuildTtsModelSettings(
  ctx: CommandContext,
  guildId: string,
): Promise<TtsRuntimeModelSettings> {
  return loadGuildModelSettings(guildId, ctx)
}

async function loadGuildTtsRuntime(
  ctx: CommandContext,
  guildId: string,
): Promise<TtsRuntimeConfig | null> {
  const apiKey = await loadGuildApiKey(guildId, ctx)
  if (apiKey === null) return null

  const modelSettings = await loadGuildModelSettings(guildId, ctx)
  return { client: new OpenRouterClient({ apiKey }), ...modelSettings }
}

export async function resolveUserTtsModel(
  ctx: CommandContext,
  guildId: string,
  userId: string,
  runtime: TtsRuntimeConfig,
): Promise<string> {
  const preferredModel = await loadUserPreferredModel(guildId, userId, ctx)
  if (preferredModel === null) return runtime.defaultModel
  return runtime.allowedModels.includes(preferredModel) ? preferredModel : runtime.defaultModel
}

export async function resolveUserTtsPreset(
  ctx: CommandContext,
  guildId: string,
  userId: string,
  runtime: TtsRuntimeConfig,
): Promise<TtsVoicePreset> {
  const preferredVoice = await loadUserPreferredVoice(guildId, userId, ctx)
  const preferredPreset = preferredVoice === null ? null : findVoicePresetByVoice(preferredVoice)
  if (preferredPreset !== null && runtime.allowedModels.includes(preferredPreset.model)) {
    return preferredPreset
  }

  const model = await resolveUserTtsModel(ctx, guildId, userId, runtime)
  return defaultVoicePresetForModel(model)
}

async function loadGuildModelSettings(
  guildId: string,
  ctx: CommandContext,
): Promise<TtsRuntimeModelSettings> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({
        defaultModel: sqlite.guildSettings.defaultModel,
        allowedModels: sqlite.guildSettings.allowedModels,
      })
      .from(sqlite.guildSettings)
      .where(eq(sqlite.guildSettings.guildId, guildId))
      .get()
    return normalizeModelSettings(row)
  }

  const rows = await ctx.db.db
    .select({
      defaultModel: pg.guildSettings.defaultModel,
      allowedModels: pg.guildSettings.allowedModels,
    })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)
  return normalizeModelSettings(rows[0])
}

function normalizeModelSettings(
  row: { defaultModel: string; allowedModels: string[] } | undefined,
): TtsRuntimeModelSettings {
  const allowedModels = sanitizeAllowedModels(row?.allowedModels)
  const defaultModel = sanitizeDefaultModel(row?.defaultModel, allowedModels)
  return { defaultModel, allowedModels }
}

function sanitizeAllowedModels(allowedModels: readonly string[] | undefined): readonly SupportedTtsModel[] {
  if (allowedModels === undefined || allowedModels.length === 0) return SUPPORTED_TTS_MODELS

  const sanitized = SUPPORTED_TTS_MODELS.filter((model) => allowedModels.includes(model))
  return sanitized.length > 0 ? sanitized : SUPPORTED_TTS_MODELS
}

function sanitizeDefaultModel(
  defaultModel: string | undefined,
  allowedModels: readonly SupportedTtsModel[],
): SupportedTtsModel {
  if (defaultModel !== undefined && isSupportedTtsModel(defaultModel) && allowedModels.includes(defaultModel)) {
    return defaultModel
  }

  if (allowedModels.includes(DEFAULT_MODEL)) return DEFAULT_MODEL

  return allowedModels[0] ?? DEFAULT_MODEL
}

function isSupportedTtsModel(model: string): model is SupportedTtsModel {
  return SUPPORTED_TTS_MODELS.includes(model as SupportedTtsModel)
}

async function loadUserPreferredModel(
  guildId: string,
  userId: string,
  ctx: CommandContext,
): Promise<string | null> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ preferredModel: sqlite.userSettings.preferredModel })
      .from(sqlite.userSettings)
      .where(
        and(eq(sqlite.userSettings.guildId, guildId), eq(sqlite.userSettings.userId, userId)),
      )
      .get()
    return row?.preferredModel ?? null
  }

  const rows = await ctx.db.db
    .select({ preferredModel: pg.userSettings.preferredModel })
    .from(pg.userSettings)
    .where(and(eq(pg.userSettings.guildId, guildId), eq(pg.userSettings.userId, userId)))
    .limit(1)
  return rows[0]?.preferredModel ?? null
}

async function loadUserPreferredVoice(
  guildId: string,
  userId: string,
  ctx: CommandContext,
): Promise<string | null> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ preferredVoice: sqlite.userSettings.preferredVoice })
      .from(sqlite.userSettings)
      .where(
        and(eq(sqlite.userSettings.guildId, guildId), eq(sqlite.userSettings.userId, userId)),
      )
      .get()
    return row?.preferredVoice ?? null
  }

  const rows = await ctx.db.db
    .select({ preferredVoice: pg.userSettings.preferredVoice })
    .from(pg.userSettings)
    .where(and(eq(pg.userSettings.guildId, guildId), eq(pg.userSettings.userId, userId)))
    .limit(1)
  return rows[0]?.preferredVoice ?? null
}

async function loadGuildApiKey(guildId: string, ctx: CommandContext): Promise<string | null> {
  const stored =
    ctx.db.dialect === 'sqlite' ? loadSqliteApiKey(guildId, ctx) : await loadPgApiKey(guildId, ctx)
  if (stored === null) return null

  const keyRing = loadRuntimeKeyRing(ctx)
  const key = keyRing.byVersion(stored.version)
  if (key === undefined) throw new Error(`Missing API key encryption key version ${String(stored.version)}`)

  const decrypted = decrypt(
    {
      ciphertext: Buffer.from(stored.encrypted, 'base64'),
      iv: Buffer.from(stored.iv, 'base64'),
      authTag: Buffer.from(stored.authTag, 'base64'),
    },
    key,
  )

  if (!decrypted.ok) {
    throw decrypted.error
  }

  return decrypted.value
}

function loadRuntimeKeyRing(ctx: CommandContext): KeyRing {
  const masterKey = parseMasterKey(ctx.config.MASTER_ENC_KEY)
  if (!masterKey.ok) {
    throw masterKey.error
  }

  const keyRing = new KeyRing()
  keyRing.addKey(ctx.config.MASTER_ENC_KEY_VERSION, masterKey.value)
  return keyRing
}

function loadSqliteApiKey(guildId: string, ctx: CommandContext): StoredApiKey | null {
  if (ctx.db.dialect !== 'sqlite') return null
  const row = ctx.db.db
    .select({
      encrypted: sqlite.guildSettings.apiKeyEncrypted,
      iv: sqlite.guildSettings.apiKeyIv,
      authTag: sqlite.guildSettings.apiKeyAuthTag,
      version: sqlite.guildSettings.apiKeyVersion,
    })
    .from(sqlite.guildSettings)
    .where(eq(sqlite.guildSettings.guildId, guildId))
    .get()

  if (
    row === undefined ||
    row.encrypted === null ||
    row.iv === null ||
    row.authTag === null ||
    row.version === null
  ) {
    return null
  }

  return { encrypted: row.encrypted, iv: row.iv, authTag: row.authTag, version: row.version }
}

async function loadPgApiKey(guildId: string, ctx: CommandContext): Promise<StoredApiKey | null> {
  if (ctx.db.dialect !== 'pg') return null
  const rows = await ctx.db.db
    .select({
      encrypted: pg.guildSettings.apiKeyEncrypted,
      iv: pg.guildSettings.apiKeyIv,
      authTag: pg.guildSettings.apiKeyAuthTag,
      version: pg.guildSettings.apiKeyVersion,
    })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)

  const row = rows[0]
  if (
    row === undefined ||
    row.encrypted === null ||
    row.iv === null ||
    row.authTag === null ||
    row.version === null
  ) {
    return null
  }

  return { encrypted: row.encrypted, iv: row.iv, authTag: row.authTag, version: row.version }
}
