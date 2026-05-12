import type { Config } from '@to-much-talker/config'
import { decode, decrypt, encode, encrypt, KeyRing, parseMasterKey } from '@to-much-talker/crypto'
import { eq, isNotNull, openDb, pg, sqlite } from '@to-much-talker/db'

import { logger } from '../logger.js'

const log = logger.child({ component: 'cli/key-rotate' })

export interface KeyRotateOptions {
  readonly newKeyBase64: string
  readonly dryRun: boolean
  readonly config: Config
}

interface RotationSummary {
  readonly rotated: number
  readonly errors: number
}

/**
 * Re-encrypt every stored per-guild API key from the current master key
 * (sourced from config.MASTER_ENC_KEY at config.MASTER_ENC_KEY_VERSION) to
 * the new key supplied via `newKeyBase64`.
 *
 * The new envelope is written back with `apiKeyVersion = currentVersion + 1`.
 *
 * Failures on individual rows are logged and counted, never raised — partial
 * progress is preserved so a re-run can recover. Key material is NEVER
 * written to stdout/stderr; only counts and guild IDs are logged.
 *
 * Exits with code 1 on configuration / DB open failure.
 */
export async function keyRotate(opts: KeyRotateOptions): Promise<void> {
  const { newKeyBase64, dryRun, config } = opts

  const currentKeyResult = parseMasterKey(config.MASTER_ENC_KEY)
  if (!currentKeyResult.ok) {
    log.error({ error: currentKeyResult.error.message }, 'Failed to parse current MASTER_ENC_KEY')
    process.exit(1)
  }

  const newKeyResult = parseMasterKey(newKeyBase64)
  if (!newKeyResult.ok) {
    log.error({ error: newKeyResult.error.message }, 'Failed to parse new key')
    process.exit(1)
  }

  const currentKey = currentKeyResult.value
  const newKey = newKeyResult.value
  const currentVersion = config.MASTER_ENC_KEY_VERSION
  const newVersion = currentVersion + 1

  const keyRing = new KeyRing()
  keyRing.addKey(currentVersion, currentKey)

  log.info({ dryRun, currentVersion, newVersion }, 'Starting key rotation')

  const dbResult = await openDb(config.DATABASE_URL)
  if (!dbResult.ok) {
    log.error({ error: dbResult.error.message }, 'Failed to open database')
    process.exit(1)
  }
  const db = dbResult.value

  try {
    const summary =
      db.dialect === 'sqlite'
        ? rotateSqlite(db.db, keyRing, newKey, newVersion, dryRun)
        : await rotatePg(db.db, keyRing, newKey, newVersion, dryRun)

    if (dryRun) {
      process.stdout.write(
        `[DRY RUN] Would rotate ${String(summary.rotated)} keys. ${String(summary.errors)} errors.\n`,
      )
    } else {
      process.stdout.write(
        `Rotated ${String(summary.rotated)} keys successfully. ${String(summary.errors)} errors.\n`,
      )
      if (summary.rotated > 0) {
        process.stdout.write(
          `New key version: ${String(newVersion)}. Update MASTER_ENC_KEY and MASTER_ENC_KEY_VERSION in .env.\n`,
        )
      }
    }
  } finally {
    if (db.dialect === 'sqlite') {
      db.close()
    } else {
      await db.close()
    }
  }
}

function reencrypt(
  encryptedB64: string,
  ivB64: string,
  authTagB64: string,
  version: number,
  keyRing: KeyRing,
  newKey: Buffer,
): { iv: string; ciphertext: string; authTag: string } | { error: string } {
  const envelope = `v1:${ivB64}:${encryptedB64}:${authTagB64}`
  const decodeResult = decode(envelope)
  if (!decodeResult.ok) {
    return { error: `decode: ${decodeResult.error.message}` }
  }

  const keyForVersion = keyRing.byVersion(version)
  if (keyForVersion === undefined) {
    return { error: `unknown key version ${String(version)}` }
  }

  const decryptResult = decrypt(decodeResult.value, keyForVersion)
  if (!decryptResult.ok) {
    return { error: `decrypt: ${decryptResult.error.message}` }
  }

  const newPayload = encrypt(decryptResult.value, newKey)
  const newEnvelope = encode(newPayload)
  const parts = newEnvelope.split(':')
  const newIv = parts[1]
  const newCt = parts[2]
  const newTag = parts[3]
  if (newIv === undefined || newCt === undefined || newTag === undefined) {
    return { error: 'failed to split new envelope' }
  }
  return { iv: newIv, ciphertext: newCt, authTag: newTag }
}

function rotateSqlite(
  db: import('@to-much-talker/db').SqliteDb['db'],
  keyRing: KeyRing,
  newKey: Buffer,
  newVersion: number,
  dryRun: boolean,
): RotationSummary {
  const rows = db
    .select({
      guildId: sqlite.guildSettings.guildId,
      apiKeyEncrypted: sqlite.guildSettings.apiKeyEncrypted,
      apiKeyIv: sqlite.guildSettings.apiKeyIv,
      apiKeyAuthTag: sqlite.guildSettings.apiKeyAuthTag,
      apiKeyVersion: sqlite.guildSettings.apiKeyVersion,
    })
    .from(sqlite.guildSettings)
    .where(isNotNull(sqlite.guildSettings.apiKeyEncrypted))
    .all()

  let rotated = 0
  let errors = 0

  for (const row of rows) {
    if (
      row.apiKeyEncrypted === null ||
      row.apiKeyIv === null ||
      row.apiKeyAuthTag === null ||
      row.apiKeyVersion === null
    ) {
      continue
    }

    const result = reencrypt(
      row.apiKeyEncrypted,
      row.apiKeyIv,
      row.apiKeyAuthTag,
      row.apiKeyVersion,
      keyRing,
      newKey,
    )
    if ('error' in result) {
      log.warn({ guildId: row.guildId, error: result.error }, 'Re-encryption failed')
      errors++
      continue
    }

    if (dryRun) {
      log.info({ guildId: row.guildId }, '[DRY RUN] Would re-encrypt API key')
      rotated++
      continue
    }

    db.update(sqlite.guildSettings)
      .set({
        apiKeyEncrypted: result.ciphertext,
        apiKeyIv: result.iv,
        apiKeyAuthTag: result.authTag,
        apiKeyVersion: newVersion,
      })
      .where(eq(sqlite.guildSettings.guildId, row.guildId))
      .run()

    rotated++
    log.debug({ guildId: row.guildId }, 'Re-encrypted API key')
  }

  return { rotated, errors }
}

async function rotatePg(
  db: import('@to-much-talker/db').PgDb['db'],
  keyRing: KeyRing,
  newKey: Buffer,
  newVersion: number,
  dryRun: boolean,
): Promise<RotationSummary> {
  const rows = await db
    .select({
      guildId: pg.guildSettings.guildId,
      apiKeyEncrypted: pg.guildSettings.apiKeyEncrypted,
      apiKeyIv: pg.guildSettings.apiKeyIv,
      apiKeyAuthTag: pg.guildSettings.apiKeyAuthTag,
      apiKeyVersion: pg.guildSettings.apiKeyVersion,
    })
    .from(pg.guildSettings)
    .where(isNotNull(pg.guildSettings.apiKeyEncrypted))

  let rotated = 0
  let errors = 0

  for (const row of rows) {
    if (
      row.apiKeyEncrypted === null ||
      row.apiKeyIv === null ||
      row.apiKeyAuthTag === null ||
      row.apiKeyVersion === null
    ) {
      continue
    }

    const result = reencrypt(
      row.apiKeyEncrypted,
      row.apiKeyIv,
      row.apiKeyAuthTag,
      row.apiKeyVersion,
      keyRing,
      newKey,
    )
    if ('error' in result) {
      log.warn({ guildId: row.guildId, error: result.error }, 'Re-encryption failed')
      errors++
      continue
    }

    if (dryRun) {
      log.info({ guildId: row.guildId }, '[DRY RUN] Would re-encrypt API key')
      rotated++
      continue
    }

    await db
      .update(pg.guildSettings)
      .set({
        apiKeyEncrypted: result.ciphertext,
        apiKeyIv: result.iv,
        apiKeyAuthTag: result.authTag,
        apiKeyVersion: newVersion,
      })
      .where(eq(pg.guildSettings.guildId, row.guildId))

    rotated++
    log.debug({ guildId: row.guildId }, 'Re-encrypted API key')
  }

  return { rotated, errors }
}
