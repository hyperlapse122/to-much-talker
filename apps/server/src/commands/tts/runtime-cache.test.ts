import { OpenRouterClient } from '@to-much-talker/ai'
import { encrypt, parseMasterKey } from '@to-much-talker/crypto'
import { describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '../context.js'
import {
  getGuildTtsRuntime,
  invalidateTtsRuntimeCache,
  resolveUserTtsModel,
  resolveUserTtsPreset,
  type TtsRuntimeConfig,
} from './runtime-cache.js'

const GEMINI_MODEL = 'google/gemini-3.1-flash-tts-preview'
const OPENAI_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'
const CURRENT_MASTER_KEY = Buffer.alloc(32, 1).toString('base64')
const OLD_MASTER_KEY = Buffer.alloc(32, 2).toString('base64')

interface ApiKeyRow {
  readonly encrypted: string | null
  readonly iv: string | null
  readonly authTag: string | null
  readonly version: number | null
}

interface ModelSettingsRow {
  readonly defaultModel: string
  readonly allowedModels: string[]
}

function buildCtx(row: {
  readonly preferredModel?: string | null
  readonly preferredVoice?: string | null
}): CommandContext {
  return buildGuildCtx({ 'guild-1:user-1': row })
}

function buildGuildCtx(
  rows: Record<
    string,
    { readonly preferredModel?: string | null; readonly preferredVoice?: string | null }
  >,
): CommandContext {
  const db = {
    dialect: 'sqlite',
    db: {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => ({ get: () => rows[rowKeyFromCondition(condition)] }),
        }),
      }),
    },
  }
  return { db, logger: { child: vi.fn() } } as unknown as CommandContext
}

function rowKeyFromCondition(condition: unknown): string {
  const tokens = conditionTokens(condition)
  const guildId = tokens.find((token) => token.startsWith('guild-'))
  const userId = tokens.find((token) => token.startsWith('user-'))
  expect(tokens).toContain('guild_id')
  expect(tokens).toContain('user_id')
  expect(guildId).toBeDefined()
  expect(userId).toBeDefined()
  return `${guildId}:${userId}`
}

function conditionTokens(value: unknown, seen = new WeakSet<object>()): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap((item) => conditionTokens(item, seen))
  if (typeof value !== 'object' || value === null || seen.has(value)) return []

  seen.add(value)
  const record = value as Record<string, unknown>
  const tokens: string[] = []
  if (typeof record.name === 'string') tokens.push(record.name)
  tokens.push(...conditionTokens(record.value, seen))
  tokens.push(...conditionTokens(record.queryChunks, seen))
  return tokens
}

function buildRuntime(allowedModels: readonly string[]): TtsRuntimeConfig {
  return {
    client: new OpenRouterClient({ apiKey: 'test-key' }),
    defaultModel: allowedModels[0] ?? GEMINI_MODEL,
    allowedModels,
  }
}

function buildRuntimeLoadCtx(rows: {
  readonly apiKey: ApiKeyRow | null
  readonly modelSettings: ModelSettingsRow | undefined
  readonly masterKey?: string
  readonly masterKeyVersion?: number
}): CommandContext {
  const db = {
    dialect: 'sqlite',
    db: {
      select: (selection: Record<string, unknown>) => ({
        from: () => ({
          where: () => ({
            get: () => ('encrypted' in selection ? rows.apiKey : rows.modelSettings),
          }),
        }),
      }),
    },
  }

  return {
    db,
    config: {
      MASTER_ENC_KEY: rows.masterKey ?? CURRENT_MASTER_KEY,
      MASTER_ENC_KEY_VERSION: rows.masterKeyVersion ?? 7,
    },
    logger: { child: vi.fn() },
  } as unknown as CommandContext
}

function encryptedApiKey(keyBase64: string, version: number): ApiKeyRow {
  const key = parseMasterKey(keyBase64)
  if (!key.ok) throw key.error

  const payload = encrypt('redacted-test-openrouter-key', key.value)
  return {
    encrypted: payload.ciphertext.toString('base64'),
    iv: payload.iv.toString('base64'),
    authTag: payload.authTag.toString('base64'),
    version,
  }
}

describe('TTS runtime preference resolution', () => {
  it('falls back when the preferred model is not guild-allowed', async () => {
    const model = await resolveUserTtsModel(
      buildCtx({ preferredModel: OPENAI_MODEL }),
      'guild-1',
      'user-1',
      buildRuntime([GEMINI_MODEL]),
    )

    expect(model).toBe(GEMINI_MODEL)
  })

  it('resolves a disallowed preferred model to the runtime default', async () => {
    const model = await resolveUserTtsModel(
      buildCtx({ preferredModel: GEMINI_MODEL }),
      'guild-1',
      'user-1',
      buildRuntime([OPENAI_MODEL]),
    )

    expect(model).toBe(OPENAI_MODEL)
  })

  it('falls back when the preferred voice belongs to a disallowed model', async () => {
    const preset = await resolveUserTtsPreset(
      buildCtx({ preferredModel: OPENAI_MODEL, preferredVoice: 'alloy' }),
      'guild-1',
      'user-1',
      buildRuntime([GEMINI_MODEL]),
    )

    expect(preset.model).toBe(GEMINI_MODEL)
    expect(preset.voice).toBe('Zephyr')
  })

  it('resolves different preferred voices for the same user in different guilds', async () => {
    const ctx = buildGuildCtx({
      'guild-1:user-1': { preferredVoice: 'Zephyr' },
      'guild-2:user-1': { preferredVoice: 'alloy' },
    })

    const guildOnePreset = await resolveUserTtsPreset(
      ctx,
      'guild-1',
      'user-1',
      buildRuntime([GEMINI_MODEL, OPENAI_MODEL]),
    )
    const guildTwoPreset = await resolveUserTtsPreset(
      ctx,
      'guild-2',
      'user-1',
      buildRuntime([GEMINI_MODEL, OPENAI_MODEL]),
    )

    expect(guildOnePreset.voice).toBe('Zephyr')
    expect(guildTwoPreset.voice).toBe('alloy')
  })

  it('does not reuse a preferred model from a different guild', async () => {
    const model = await resolveUserTtsModel(
      buildGuildCtx({ 'guild-1:user-1': { preferredModel: OPENAI_MODEL } }),
      'guild-2',
      'user-1',
      buildRuntime([GEMINI_MODEL, OPENAI_MODEL]),
    )

    expect(model).toBe(GEMINI_MODEL)
  })
})

describe('TTS runtime model policy', () => {
  it('falls back to the authoritative default when the DB default is unsupported', async () => {
    const guildId = 'guild-invalid-default'
    invalidateTtsRuntimeCache(guildId)

    const runtime = await getGuildTtsRuntime(
      buildRuntimeLoadCtx({
        apiKey: encryptedApiKey(CURRENT_MASTER_KEY, 7),
        modelSettings: {
          defaultModel: 'unsupported/default-model',
          allowedModels: [GEMINI_MODEL, OPENAI_MODEL],
        },
      }),
      guildId,
    )

    expect(runtime?.defaultModel).toBe(GEMINI_MODEL)
    expect(runtime?.allowedModels).toEqual([GEMINI_MODEL, OPENAI_MODEL])
  })

  it('falls back to the first allowed supported model when the authoritative default is disallowed', async () => {
    const guildId = 'guild-default-disallowed'
    invalidateTtsRuntimeCache(guildId)

    const runtime = await getGuildTtsRuntime(
      buildRuntimeLoadCtx({
        apiKey: encryptedApiKey(CURRENT_MASTER_KEY, 7),
        modelSettings: {
          defaultModel: 'unsupported/default-model',
          allowedModels: [OPENAI_MODEL],
        },
      }),
      guildId,
    )

    expect(runtime?.defaultModel).toBe(OPENAI_MODEL)
    expect(runtime?.allowedModels).toEqual([OPENAI_MODEL])
  })

  it('removes unsupported allowed models from DB settings', async () => {
    const guildId = 'guild-unsupported-allowed'
    invalidateTtsRuntimeCache(guildId)

    const runtime = await getGuildTtsRuntime(
      buildRuntimeLoadCtx({
        apiKey: encryptedApiKey(CURRENT_MASTER_KEY, 7),
        modelSettings: {
          defaultModel: OPENAI_MODEL,
          allowedModels: ['made-up/model', OPENAI_MODEL],
        },
      }),
      guildId,
    )

    expect(runtime?.defaultModel).toBe(OPENAI_MODEL)
    expect(runtime?.allowedModels).toEqual([OPENAI_MODEL])
  })

  it('uses all supported models when every DB allowed entry is unsupported', async () => {
    const guildId = 'guild-all-unsupported'
    invalidateTtsRuntimeCache(guildId)

    const runtime = await getGuildTtsRuntime(
      buildRuntimeLoadCtx({
        apiKey: encryptedApiKey(CURRENT_MASTER_KEY, 7),
        modelSettings: {
          defaultModel: 'unsupported/default-model',
          allowedModels: ['made-up/model', 'another/model'],
        },
      }),
      guildId,
    )

    expect(runtime?.defaultModel).toBe(GEMINI_MODEL)
    expect(runtime?.allowedModels).toEqual([GEMINI_MODEL, OPENAI_MODEL])
  })
})

describe('TTS runtime API key decryption', () => {
  it('decrypts stored guild API keys with the stored key version', async () => {
    const guildId = 'guild-key-version-success'
    invalidateTtsRuntimeCache(guildId)

    const runtime = await getGuildTtsRuntime(
      buildRuntimeLoadCtx({
        apiKey: encryptedApiKey(CURRENT_MASTER_KEY, 7),
        modelSettings: undefined,
      }),
      guildId,
    )

    expect(runtime).not.toBeNull()
    expect(runtime?.defaultModel).toBe(GEMINI_MODEL)
  })

  it('fails safely for a missing stored key version and does not cache the failure as success', async () => {
    const guildId = 'guild-missing-key-version'
    invalidateTtsRuntimeCache(guildId)
    let apiKey = encryptedApiKey(CURRENT_MASTER_KEY, 8)

    const ctx = buildRuntimeLoadCtx({
      get apiKey() {
        return apiKey
      },
      modelSettings: undefined,
    })

    await expect(getGuildTtsRuntime(ctx, guildId)).rejects.toThrow(
      'Missing API key encryption key version 8',
    )

    apiKey = encryptedApiKey(CURRENT_MASTER_KEY, 7)
    await expect(getGuildTtsRuntime(ctx, guildId)).resolves.not.toBeNull()
  })

  it('fails safely for a wrong key at the stored version and does not cache the failure as success', async () => {
    const guildId = 'guild-wrong-key-version'
    invalidateTtsRuntimeCache(guildId)
    let apiKey = encryptedApiKey(OLD_MASTER_KEY, 7)

    const ctx = buildRuntimeLoadCtx({
      get apiKey() {
        return apiKey
      },
      modelSettings: undefined,
    })

    await expect(getGuildTtsRuntime(ctx, guildId)).rejects.toThrow('Decryption failed')

    apiKey = encryptedApiKey(CURRENT_MASTER_KEY, 7)
    await expect(getGuildTtsRuntime(ctx, guildId)).resolves.not.toBeNull()
  })
})
