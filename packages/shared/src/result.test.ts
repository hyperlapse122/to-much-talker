import { describe, it, expect } from 'vitest'
import type { Result } from './result.js'
import { err, isErr, isOk, mapResult, ok, unwrapOr } from './result.js'

describe('Result helpers', () => {
  it('ok() creates success result', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe(42)
    }
  })

  it('err() creates failure result', () => {
    const r = err('something went wrong')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('something went wrong')
    }
  })

  it('isOk() narrows type correctly', () => {
    const r = ok('hello')
    expect(isOk(r)).toBe(true)
    if (isOk(r)) {
      expect(r.value).toBe('hello')
    }
  })

  it('isErr() narrows type correctly', () => {
    const r = err(new Error('fail'))
    expect(isErr(r)).toBe(true)
    if (isErr(r)) {
      expect(r.error).toBeInstanceOf(Error)
    }
  })

  it('mapResult() transforms success value', () => {
    const r: Result<number, string> = ok(5)
    const mapped = mapResult(r, (n) => n * 2)
    expect(mapped.ok).toBe(true)
    if (mapped.ok) {
      expect(mapped.value).toBe(10)
    }
  })

  it('mapResult() passes through error unchanged', () => {
    const r: Result<number, string> = err('oops')
    const mapped = mapResult(r, (n) => n * 2)
    expect(mapped.ok).toBe(false)
    if (!mapped.ok) {
      expect(mapped.error).toBe('oops')
    }
  })

  it('unwrapOr() returns value on success', () => {
    const r: Result<number, string> = ok(42)
    expect(unwrapOr(r, 0)).toBe(42)
  })

  it('unwrapOr() returns fallback on failure', () => {
    const r: Result<number, string> = err('fail')
    expect(unwrapOr(r, 99)).toBe(99)
  })
})
