import { describe, expect, it } from 'vitest'
import { decode, decrypt, encode, encrypt } from './gcm.js'
import { generateMasterKey, parseMasterKey } from './keys.js'

describe('AES-256-GCM roundtrip', () => {
  it('encrypts and decrypts correctly', () => {
    const key = parseMasterKey(generateMasterKey())
    expect(key.ok).toBe(true)
    if (!key.ok) return

    const plaintext = 'hello, secret world!'
    const payload = encrypt(plaintext, key.value)
    const result = decrypt(payload, key.value)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(plaintext)
    }
  })

  it('returns err when decrypting with wrong key', () => {
    const key1 = parseMasterKey(generateMasterKey())
    const key2 = parseMasterKey(generateMasterKey())
    expect(key1.ok).toBe(true)
    expect(key2.ok).toBe(true)
    if (!key1.ok || !key2.ok) return

    const payload = encrypt('secret', key1.value)
    const result = decrypt(payload, key2.value)

    expect(result.ok).toBe(false)
  })

  it('encode/decode roundtrip preserves payload', () => {
    const key = parseMasterKey(generateMasterKey())
    expect(key.ok).toBe(true)
    if (!key.ok) return

    const payload = encrypt('test message', key.value)
    const encoded = encode(payload)
    const decoded = decode(encoded)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    const decrypted = decrypt(decoded.value, key.value)
    expect(decrypted.ok).toBe(true)
    if (decrypted.ok) {
      expect(decrypted.value).toBe('test message')
    }
  })

  it('decode rejects invalid envelope format', () => {
    const result = decode('invalid-envelope')
    expect(result.ok).toBe(false)
  })

  it('decode rejects wrong version prefix', () => {
    const result = decode('v2:aaa:bbb:ccc')
    expect(result.ok).toBe(false)
  })

  it('encode produces v1: prefixed string', () => {
    const key = parseMasterKey(generateMasterKey())
    expect(key.ok).toBe(true)
    if (!key.ok) return

    const payload = encrypt('hi', key.value)
    const encoded = encode(payload)
    expect(encoded.startsWith('v1:')).toBe(true)
    expect(encoded.split(':')).toHaveLength(4)
  })

  it('generateMasterKey produces 32-byte base64 string', () => {
    const k = generateMasterKey()
    const parsed = parseMasterKey(k)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.length).toBe(32)
    }
  })

  it('parseMasterKey rejects keys of wrong length', () => {
    const short = Buffer.alloc(16).toString('base64')
    const result = parseMasterKey(short)
    expect(result.ok).toBe(false)
  })
})
