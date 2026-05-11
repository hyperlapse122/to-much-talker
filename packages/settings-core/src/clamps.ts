// Pure helper functions for settings resolution.

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
