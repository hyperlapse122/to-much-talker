import { OpenRouterClient } from '@to-much-talker/ai'
import { describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '../context.js'
import {
  resolveUserTtsModel,
  resolveUserTtsPreset,
  type TtsRuntimeConfig,
} from './runtime-cache.js'

const GEMINI_MODEL = 'google/gemini-3.1-flash-tts-preview'
const OPENAI_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'

function buildCtx(row: {
  readonly preferredModel?: string | null
  readonly preferredVoice?: string | null
}): CommandContext {
  const db = {
    dialect: 'sqlite',
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ get: () => row }),
        }),
      }),
    },
  }
  return { db, logger: { child: vi.fn() } } as unknown as CommandContext
}

function buildRuntime(allowedModels: readonly string[]): TtsRuntimeConfig {
  return {
    client: new OpenRouterClient({ apiKey: 'test-key' }),
    defaultModel: GEMINI_MODEL,
    allowedModels,
  }
}

describe('TTS runtime preference resolution', () => {
  it('falls back when the preferred model is not guild-allowed', async () => {
    const model = await resolveUserTtsModel(
      buildCtx({ preferredModel: OPENAI_MODEL }),
      'user-1',
      buildRuntime([GEMINI_MODEL]),
    )

    expect(model).toBe(GEMINI_MODEL)
  })

  it('falls back when the preferred voice belongs to a disallowed model', async () => {
    const preset = await resolveUserTtsPreset(
      buildCtx({ preferredModel: OPENAI_MODEL, preferredVoice: 'alloy' }),
      'user-1',
      buildRuntime([GEMINI_MODEL]),
    )

    expect(preset.model).toBe(GEMINI_MODEL)
    expect(preset.voice).toBe('Zephyr')
  })
})
