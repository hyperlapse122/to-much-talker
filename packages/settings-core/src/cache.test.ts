import { describe, expect, it } from 'vitest'
import { LruCache, SettingsCache } from './cache.js'
import type { ResolvedSettings } from './resolver.js'

function makeSettings(overrides: Partial<ResolvedSettings> = {}): ResolvedSettings {
  return {
    maxChars: 500,
    maxPriceCents: null,
    defaultModel: 'google/gemini-3.1-flash-tts-preview',
    defaultVoice: null,
    queueStrategy: 'drop-oldest',
    maxQueueSize: 20,
    locale: 'en',
    idleTextInactivityMs: 300_000,
    idleLeaveOnEmpty: true,
    allowedModels: [],
    permissionsRoleId: null,
    boundTextChannelId: null,
    ...overrides,
  }
}

describe('LruCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LruCache<string, number>(10)
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
  })

  it('returns undefined for missing key', () => {
    const cache = new LruCache<string, number>(10)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('evicts LRU entry when at capacity', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3) // evicts 'a'
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('updating existing key does not evict', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 10) // update, not add
    expect(cache.get('a')).toBe(10)
    expect(cache.get('b')).toBe(2)
  })

  it('access promotes entry to most-recently-used', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // touch 'a', making 'b' the LRU
    cache.set('c', 3) // evicts 'b'
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
  })

  it('expires entries after TTL', async () => {
    const cache = new LruCache<string, number>(10, 50)
    cache.set('x', 42)
    await new Promise((r) => setTimeout(r, 80))
    expect(cache.get('x')).toBeUndefined()
  })

  it('delete removes entry', () => {
    const cache = new LruCache<string, number>(10)
    cache.set('a', 1)
    expect(cache.delete('a')).toBe(true)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.delete('missing')).toBe(false)
  })

  it('clear empties the cache', () => {
    const cache = new LruCache<string, number>(10)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('size reflects current entry count', () => {
    const cache = new LruCache<string, number>(10)
    expect(cache.size).toBe(0)
    cache.set('a', 1)
    expect(cache.size).toBe(1)
    cache.set('b', 2)
    expect(cache.size).toBe(2)
    cache.delete('a')
    expect(cache.size).toBe(1)
  })
})

describe('SettingsCache', () => {
  it('stores and retrieves settings by guild key', () => {
    const cache = new SettingsCache()
    const settings = makeSettings()
    cache.set({ guildId: 'g1' }, settings)
    expect(cache.get({ guildId: 'g1' })).toEqual(settings)
  })

  it('distinguishes guild vs guild+channel keys', () => {
    const cache = new SettingsCache()
    const guildOnly = makeSettings({ maxChars: 100 })
    const guildChan = makeSettings({ maxChars: 200 })
    cache.set({ guildId: 'g1' }, guildOnly)
    cache.set({ guildId: 'g1', channelId: 'c1' }, guildChan)

    expect(cache.get({ guildId: 'g1' })?.maxChars).toBe(100)
    expect(cache.get({ guildId: 'g1', channelId: 'c1' })?.maxChars).toBe(200)
  })

  it('invalidate removes all entries for a guild', () => {
    const cache = new SettingsCache()
    const s = makeSettings()
    cache.set({ guildId: 'g1' }, s)
    cache.set({ guildId: 'g1', channelId: 'c1' }, s)
    cache.set({ guildId: 'g1', userId: 'u1' }, s)
    cache.set({ guildId: 'g2' }, s)

    cache.invalidate('g1')

    expect(cache.get({ guildId: 'g1' })).toBeUndefined()
    expect(cache.get({ guildId: 'g1', channelId: 'c1' })).toBeUndefined()
    expect(cache.get({ guildId: 'g1', userId: 'u1' })).toBeUndefined()
    expect(cache.get({ guildId: 'g2' })).toEqual(s)
  })

  it('clear empties the cache', () => {
    const cache = new SettingsCache()
    cache.set({ guildId: 'g1' }, makeSettings())
    cache.set({ guildId: 'g2' }, makeSettings())
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('size reflects current entry count', () => {
    const cache = new SettingsCache()
    expect(cache.size).toBe(0)
    cache.set({ guildId: 'g1' }, makeSettings())
    cache.set({ guildId: 'g2' }, makeSettings())
    expect(cache.size).toBe(2)
  })
})
