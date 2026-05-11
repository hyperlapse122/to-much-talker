// Ephemeral database helper for tests
// Full implementation available after Task 8 (packages/db runtime)
// For now: provides the interface that test code can depend on

export interface EphemeralDbOptions {
  readonly dialect: 'sqlite' | 'pg'
}

// Placeholder type — will be replaced with proper Db type from packages/db in Task 8
export interface EphemeralDb {
  readonly dialect: 'sqlite' | 'pg'
  close(): void
}

// Deferred implementation: openEphemeralDb returns a stub until packages/db is available
// Tests using this helper will be added in Task 29 after Task 8 is complete
export async function openEphemeralDb(opts: EphemeralDbOptions): Promise<EphemeralDb> {
  if (opts.dialect === 'pg') {
    const hasEnv = process.env['RUN_PG_TESTS'] === '1'
    if (!hasEnv) {
      throw new Error(
        'Postgres ephemeral DB requires RUN_PG_TESTS=1 env var and a running Postgres testcontainer',
      )
    }
    // Full pg testcontainer implementation deferred to Task 29
    throw new Error('Postgres testcontainer not yet implemented — see Task 29')
  }

  // SQLite in-memory — will use better-sqlite3 once packages/db is ready
  // For now, return a typed stub
  return {
    dialect: 'sqlite',
    close(): void {
      // no-op until real implementation
    },
  }
}
