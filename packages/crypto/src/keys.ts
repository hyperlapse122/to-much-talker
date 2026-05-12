import { randomBytes } from 'node:crypto'
import type { Result } from '@to-much-talker/shared'
import { EncryptionError, err, ok } from '@to-much-talker/shared'

export function generateMasterKey(): string {
  return randomBytes(32).toString('base64')
}

export function parseMasterKey(s: string): Result<Buffer, EncryptionError> {
  try {
    const buf = Buffer.from(s, 'base64')
    if (buf.length !== 32) {
      return err(
        new EncryptionError(`Master key must be 32 bytes (256 bits). Got ${buf.length} bytes.`),
      )
    }
    return ok(buf)
  } catch (cause) {
    return err(new EncryptionError('Failed to parse master key', cause))
  }
}

export class KeyRing {
  readonly #keys = new Map<number, Buffer>()
  #currentVersion = 0

  addKey(version: number, key: Buffer): void {
    if (key.length !== 32) {
      throw new EncryptionError(`Key for version ${version} must be 32 bytes`)
    }
    this.#keys.set(version, key)
    if (version > this.#currentVersion) {
      this.#currentVersion = version
    }
  }

  current(): { version: number; key: Buffer } | undefined {
    const key = this.#keys.get(this.#currentVersion)
    if (key === undefined) return undefined
    return { version: this.#currentVersion, key }
  }

  byVersion(version: number): Buffer | undefined {
    return this.#keys.get(version)
  }
}
