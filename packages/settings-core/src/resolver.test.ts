import { describe, expect, it } from 'vitest'
import { resolveSettings } from './resolver.js'

describe('resolveSettings', () => {
  it('uses server maxChars when channel has no override', () => {
    const resolved = resolveSettings({
      server: { maxChars: 200 },
      channel: null,
      user: null,
    })
    expect(resolved.maxChars).toBe(200)
  })

  it('clamps channel maxChars to server ceiling', () => {
    const resolved = resolveSettings({
      server: { maxChars: 200 },
      channel: { maxChars: 300 },
      user: null,
    })
    expect(resolved.maxChars).toBe(200)
  })

  it('allows channel maxChars when below server ceiling', () => {
    const resolved = resolveSettings({
      server: { maxChars: 500 },
      channel: { maxChars: 100 },
      user: null,
    })
    expect(resolved.maxChars).toBe(100)
  })

  it('allows model override if in allowed list', () => {
    const resolved = resolveSettings({
      server: {
        defaultModel: 'google/gemini-3.1-flash-tts-preview',
        allowedModels: ['google/gemini-3.1-flash-tts-preview', 'openai/gpt-4o-mini-tts-2025-12-15'],
      },
      channel: null,
      user: { preferredModel: 'google/gemini-3.1-flash-tts-preview' },
    })
    expect(resolved.defaultModel).toBe('google/gemini-3.1-flash-tts-preview')
  })

  it('rejects model override if NOT in allowed list', () => {
    const resolved = resolveSettings({
      server: {
        defaultModel: 'google/gemini-3.1-flash-tts-preview',
        allowedModels: ['google/gemini-3.1-flash-tts-preview'],
      },
      channel: null,
      user: { preferredModel: 'some/unknown-model' },
    })
    expect(resolved.defaultModel).toBe('google/gemini-3.1-flash-tts-preview')
  })

  it('user locale wins over server locale', () => {
    const resolved = resolveSettings({
      server: { locale: 'en' },
      channel: null,
      user: { preferredLocale: 'ja' },
    })
    expect(resolved.locale).toBe('ja')
  })

  it('uses server default locale when no user preference', () => {
    const resolved = resolveSettings({
      server: { locale: 'ko' },
      channel: null,
      user: null,
    })
    expect(resolved.locale).toBe('ko')
  })

  it('returns defaults when all inputs are null', () => {
    const resolved = resolveSettings({
      server: null,
      channel: null,
      user: null,
    })
    expect(resolved.maxChars).toBe(500)
    expect(resolved.defaultModel).toBe('google/gemini-3.1-flash-tts-preview')
    expect(resolved.locale).toBe('en')
    expect(resolved.queueStrategy).toBe('drop-oldest')
    expect(resolved.maxQueueSize).toBe(20)
    expect(resolved.idleLeaveOnEmpty).toBe(true)
    expect(resolved.defaultVoice).toBeNull()
    expect(resolved.maxPriceCents).toBeNull()
    expect(resolved.allowedModels).toEqual([
      'google/gemini-3.1-flash-tts-preview',
      'openai/gpt-4o-mini-tts-2025-12-15',
    ])
  })

  it('user preferredVoice wins over server defaultVoice', () => {
    const resolved = resolveSettings({
      server: { defaultVoice: 'voice-server' },
      channel: null,
      user: { preferredVoice: 'voice-user' },
    })
    expect(resolved.defaultVoice).toBe('voice-user')
  })

  it('falls back to server defaultVoice when no user preference', () => {
    const resolved = resolveSettings({
      server: { defaultVoice: 'voice-server' },
      channel: null,
      user: null,
    })
    expect(resolved.defaultVoice).toBe('voice-server')
  })

  it('reads channel queueStrategy', () => {
    const resolved = resolveSettings({
      server: null,
      channel: { queueStrategy: 'interrupt' },
      user: null,
    })
    expect(resolved.queueStrategy).toBe('interrupt')
  })

  it('reads channel maxQueueSize', () => {
    const resolved = resolveSettings({
      server: null,
      channel: { maxQueueSize: 50 },
      user: null,
    })
    expect(resolved.maxQueueSize).toBe(50)
  })

  it('idleLeaveOnEmpty defaults to true when missing', () => {
    const resolved = resolveSettings({
      server: {},
      channel: null,
      user: null,
    })
    expect(resolved.idleLeaveOnEmpty).toBe(true)
  })

  it('idleLeaveOnEmpty respects explicit false', () => {
    const resolved = resolveSettings({
      server: { idleLeaveOnEmpty: false },
      channel: null,
      user: null,
    })
    expect(resolved.idleLeaveOnEmpty).toBe(false)
  })

  it('idleLeaveOnEmpty coerces number 0 to false', () => {
    const resolved = resolveSettings({
      server: { idleLeaveOnEmpty: 0 },
      channel: null,
      user: null,
    })
    expect(resolved.idleLeaveOnEmpty).toBe(false)
  })

  it('reads permissionsRoleId from server', () => {
    const resolved = resolveSettings({
      server: { permissionsRoleId: 'role-123' },
      channel: null,
      user: null,
    })
    expect(resolved.permissionsRoleId).toBe('role-123')
  })

  it('reads boundTextChannelId from channel', () => {
    const resolved = resolveSettings({
      server: null,
      channel: { boundTextChannelId: 'chan-456' },
      user: null,
    })
    expect(resolved.boundTextChannelId).toBe('chan-456')
  })

  it('rejects invalid locale and falls back to default', () => {
    const resolved = resolveSettings({
      server: { locale: 'invalid-locale' },
      channel: null,
      user: null,
    })
    expect(resolved.locale).toBe('en')
  })

  it('rejects invalid queueStrategy and falls back to drop-oldest', () => {
    const resolved = resolveSettings({
      server: null,
      channel: { queueStrategy: 'bogus' },
      user: null,
    })
    expect(resolved.queueStrategy).toBe('drop-oldest')
  })
})
