import { OpenRouterClient } from '@to-much-talker/ai'
import { decrypt, parseMasterKey } from '@to-much-talker/crypto'
import { eq, pg, sqlite } from '@to-much-talker/db'
import type { CommandContext } from '../context.js'

const DEFAULT_MODEL = 'google/gemini-3.1-flash-tts-preview'
const SUPPORTED_TTS_MODELS = [DEFAULT_MODEL, 'openai/gpt-4o-mini-tts-2025-12-15'] as const

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
  userId: string,
  runtime: TtsRuntimeConfig,
): Promise<string> {
  const preferredModel = await loadUserPreferredModel(userId, ctx)
  if (preferredModel === null) return runtime.defaultModel
  if (SUPPORTED_TTS_MODELS.includes(preferredModel as (typeof SUPPORTED_TTS_MODELS)[number])) {
    return preferredModel
  }
  return runtime.allowedModels.includes(preferredModel) ? preferredModel : runtime.defaultModel
}

async function loadGuildModelSettings(
  guildId: string,
  ctx: CommandContext,
): Promise<Pick<TtsRuntimeConfig, 'defaultModel' | 'allowedModels'>> {
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
    .select({ defaultModel: pg.guildSettings.defaultModel, allowedModels: pg.guildSettings.allowedModels })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)
  return normalizeModelSettings(rows[0])
}

function normalizeModelSettings(
  row: { defaultModel: string; allowedModels: string[] } | undefined,
): Pick<TtsRuntimeConfig, 'defaultModel' | 'allowedModels'> {
  if (row === undefined) return { defaultModel: DEFAULT_MODEL, allowedModels: SUPPORTED_TTS_MODELS }
  return {
    defaultModel: row.defaultModel,
    allowedModels: row.allowedModels.length > 0 ? row.allowedModels : SUPPORTED_TTS_MODELS,
  }
}

async function loadUserPreferredModel(userId: string, ctx: CommandContext): Promise<string | null> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ preferredModel: sqlite.userSettings.preferredModel })
      .from(sqlite.userSettings)
      .where(eq(sqlite.userSettings.userId, userId))
      .get()
    return row?.preferredModel ?? null
  }

  const rows = await ctx.db.db
    .select({ preferredModel: pg.userSettings.preferredModel })
    .from(pg.userSettings)
    .where(eq(pg.userSettings.userId, userId))
    .limit(1)
  return rows[0]?.preferredModel ?? null
}

async function loadGuildApiKey(guildId: string, ctx: CommandContext): Promise<string | null> {
  const stored =
    ctx.db.dialect === 'sqlite' ? loadSqliteApiKey(guildId, ctx) : await loadPgApiKey(guildId, ctx)
  if (stored === null) return null

  const masterKey = parseMasterKey(ctx.config.MASTER_ENC_KEY)
  if (!masterKey.ok) {
    throw masterKey.error
  }

  const decrypted = decrypt(
    {
      ciphertext: Buffer.from(stored.encrypted, 'base64'),
      iv: Buffer.from(stored.iv, 'base64'),
      authTag: Buffer.from(stored.authTag, 'base64'),
    },
    masterKey.value,
  )

  if (!decrypted.ok) {
    throw decrypted.error
  }

  return decrypted.value
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
