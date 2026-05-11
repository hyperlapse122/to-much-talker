import type { ResolvedSettings } from './resolver.js'

const MAX_ENTRIES = 10_000
const TTL_MS = 10 * 60 * 1000

interface CacheEntry<V> {
  readonly value: V
  readonly expiresAt: number
}

export class LruCache<K, V> {
  readonly #map = new Map<K, CacheEntry<V>>()
  readonly #maxSize: number
  readonly #ttlMs: number

  constructor(maxSize = MAX_ENTRIES, ttlMs = TTL_MS) {
    this.#maxSize = maxSize
    this.#ttlMs = ttlMs
  }

  get(key: K): V | undefined {
    const entry = this.#map.get(key)
    if (entry === undefined) return undefined
    if (Date.now() > entry.expiresAt) {
      this.#map.delete(key)
      return undefined
    }

    this.#map.delete(key)
    this.#map.set(key, entry)
    return entry.value
  }

  set(key: K, value: V): void {
    if (this.#map.has(key)) {
      this.#map.delete(key)
    } else if (this.#map.size >= this.#maxSize) {
      const firstKey = this.#map.keys().next().value
      if (firstKey !== undefined) {
        this.#map.delete(firstKey)
      }
    }

    this.#map.set(key, { value, expiresAt: Date.now() + this.#ttlMs })
  }

  delete(key: K): boolean {
    return this.#map.delete(key)
  }

  clear(): void {
    this.#map.clear()
  }

  keys(): IterableIterator<K> {
    return this.#map.keys()
  }

  get size(): number {
    return this.#map.size
  }
}

export interface SettingsCacheKey {
  readonly guildId: string
  readonly channelId?: string
  readonly userId?: string
}

function serializeKey(key: SettingsCacheKey): string {
  return `${key.guildId}:${key.channelId ?? ''}:${key.userId ?? ''}`
}

export class SettingsCache {
  readonly #lru: LruCache<string, ResolvedSettings>

  constructor(maxEntries = MAX_ENTRIES, ttlMs = TTL_MS) {
    this.#lru = new LruCache(maxEntries, ttlMs)
  }

  get(key: SettingsCacheKey): ResolvedSettings | undefined {
    return this.#lru.get(serializeKey(key))
  }

  set(key: SettingsCacheKey, value: ResolvedSettings): void {
    this.#lru.set(serializeKey(key), value)
  }

  invalidate(guildId: string): void {
    const prefix = `${guildId}:`
    const toDelete: string[] = []

    for (const key of this.#lru.keys()) {
      if (key.startsWith(prefix)) {
        toDelete.push(key)
      }
    }

    for (const key of toDelete) {
      this.#lru.delete(key)
    }
  }

  clear(): void {
    this.#lru.clear()
  }

  get size(): number {
    return this.#lru.size
  }
}
