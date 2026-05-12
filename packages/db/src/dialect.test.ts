import { describe, expect, it } from 'vitest'
import { detectDialect } from './dialect.js'

describe('detectDialect', () => {
  it('detects sqlite:// scheme', () => {
    const result = detectDialect('sqlite://./data/bot.db')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('sqlite')
  })

  it('detects file: scheme', () => {
    const result = detectDialect('file:./data/bot.db')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('sqlite')
  })

  it('detects postgres:// scheme', () => {
    const result = detectDialect('postgres://user:pass@localhost:5432/db')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('pg')
  })

  it('detects postgresql:// scheme', () => {
    const result = detectDialect('postgresql://user:pass@localhost:5432/db')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('pg')
  })

  it('returns err for unknown scheme', () => {
    const result = detectDialect('redis://localhost:6379')
    expect(result.ok).toBe(false)
  })

  it('returns err for empty string', () => {
    const result = detectDialect('')
    expect(result.ok).toBe(false)
  })

  it('returns err for unprefixed path', () => {
    const result = detectDialect('./data/bot.db')
    expect(result.ok).toBe(false)
  })

  it('error message includes the scheme prefix', () => {
    const result = detectDialect('mongodb://localhost')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('mongodb')
    }
  })
})
