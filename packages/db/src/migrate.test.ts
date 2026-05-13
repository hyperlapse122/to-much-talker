import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openSqlite } from './sqlite/client.js'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()

  return {
    ...actual,
    existsSync: () => false,
  }
})

vi.mock('better-sqlite3', () => ({
  default: class MockDatabase {
    constructor(filePath: string) {
      if (filePath !== ':memory:') {
        fs.writeFileSync(filePath, '')
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
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('runMigrations', () => {
  it('does not resolve migrations during module import', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'tmt-db-'))
    createdDirs.push(root)
    const cwd = process.cwd()
    process.chdir(root)

    try {
      await expect(import('./migrate.js')).resolves.toBeDefined()
    } finally {
      process.chdir(cwd)
    }
  })

  it('throws when migrations cannot be discovered during execution', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'tmt-db-'))
    createdDirs.push(root)
    const cwd = process.cwd()
    process.chdir(root)
    const db = openSqlite(`sqlite://${join(root, 'db.sqlite')}`)

    try {
      const { runMigrations } = await import('./migrate.js')

      await expect(runMigrations(db)).rejects.toThrow(
        'Could not locate database migrations directory',
      )
    } finally {
      db.close()
      process.chdir(cwd)
    }
  })
})
