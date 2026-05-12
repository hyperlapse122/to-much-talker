import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { openSqlite } from './client.js'

const createdDirs: string[] = []

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('openSqlite', () => {
  it('creates parent directories for sqlite files', () => {
    const root = mkdtempSync(join(tmpdir(), 'tmt-db-'))
    createdDirs.push(root)
    const dbPath = join(root, 'nested', 'bot.db')

    const db = openSqlite(`sqlite://${dbPath}`)

    try {
      expect(existsSync(dbPath)).toBe(true)
    } finally {
      db.close()
    }
  })
})
