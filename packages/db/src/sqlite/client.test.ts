import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openSqlite } from './client.js'

vi.mock('better-sqlite3', () => ({
  default: class MockDatabase {
    constructor(filePath: string) {
      if (filePath !== ':memory:') {
        writeFileSync(filePath, '')
      }
    }

    close(): void {
      void 0
    }
  },
}))

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
