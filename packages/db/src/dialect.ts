import type { Result } from '@to-much-talker/shared'
import { ConfigError } from '@to-much-talker/shared'

export type Dialect = 'sqlite' | 'pg'

export function detectDialect(url: string): Result<Dialect, ConfigError> {
  if (url.startsWith('sqlite://') || url.startsWith('file:')) {
    return { ok: true, value: 'sqlite' }
  }

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return { ok: true, value: 'pg' }
  }

  return {
    ok: false,
    error: new ConfigError(
      `Unsupported DATABASE_URL scheme: "${url.split('://')[0] ?? url}". Expected: sqlite://, file:, postgres://, or postgresql://`,
    ),
  }
}
