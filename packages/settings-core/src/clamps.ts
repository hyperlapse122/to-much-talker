// Pure helper functions for settings resolution.

export const MIN_TTS_MAX_CHARS = 1
export const MAX_TTS_MAX_CHARS = 2000
export const DEFAULT_TTS_MAX_CHARS = 500

export function clampTtsMaxChars(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Math.min(Math.max(Math.trunc(value), MIN_TTS_MAX_CHARS), MAX_TTS_MAX_CHARS)
}

export function isTtsMaxCharsInRange(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_TTS_MAX_CHARS && value <= MAX_TTS_MAX_CHARS
}

export function clampMax(
  value: number | null | undefined,
  ceiling: number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null
  if (ceiling === null || ceiling === undefined) return value
  return Math.min(value, ceiling)
}

export function intersectAllowlist(
  requested: string | null | undefined,
  allowed: readonly string[] | null | undefined,
): string | null {
  if (requested === null || requested === undefined) return null
  if (allowed === null || allowed === undefined || allowed.length === 0) return null
  return allowed.includes(requested) ? requested : null
}

export function coerceBoolean(
  value: boolean | number | null | undefined,
  fallback: boolean,
): boolean {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return fallback
}
