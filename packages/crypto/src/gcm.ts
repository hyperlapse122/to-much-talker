import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Result } from '@to-much-talker/shared'
import { EncryptionError, err, ok } from '@to-much-talker/shared'

export interface EncryptedPayload {
  readonly iv: Buffer
  readonly ciphertext: Buffer
  readonly authTag: Buffer
}

export function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return { iv, ciphertext: encrypted, authTag }
}

export function decrypt(payload: EncryptedPayload, key: Buffer): Result<string, EncryptionError> {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, payload.iv)
    decipher.setAuthTag(payload.authTag)
    const decrypted = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()])
    return ok(decrypted.toString('utf8'))
  } catch (cause) {
    return err(
      new EncryptionError('Decryption failed: authentication tag mismatch or corrupt data', cause),
    )
  }
}

export function encode(payload: EncryptedPayload): string {
  return [
    'v1',
    payload.iv.toString('base64'),
    payload.ciphertext.toString('base64'),
    payload.authTag.toString('base64'),
  ].join(':')
}

export function decode(s: string): Result<EncryptedPayload, EncryptionError> {
  const parts = s.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return err(new EncryptionError(`Invalid envelope format: ${s.slice(0, 20)}`))
  }
  const ivB64 = parts[1]
  const ctB64 = parts[2]
  const tagB64 = parts[3]
  if (ivB64 === undefined || ctB64 === undefined || tagB64 === undefined) {
    return err(new EncryptionError('Missing envelope parts'))
  }
  try {
    return ok({
      iv: Buffer.from(ivB64, 'base64'),
      ciphertext: Buffer.from(ctB64, 'base64'),
      authTag: Buffer.from(tagB64, 'base64'),
    })
  } catch (cause) {
    return err(new EncryptionError('Failed to decode envelope', cause))
  }
}
