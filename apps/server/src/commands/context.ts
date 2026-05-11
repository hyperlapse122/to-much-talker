import type { Client } from 'discord.js'
import type { Config } from '@to-much-talker/config'
import type { Db } from '@to-much-talker/db'
import type { SettingsCache, IpcTransport } from '@to-much-talker/settings-core'
import type { Logger } from '../logger.js'

/**
 * Shared resources passed to every command handler.
 *
 * Handlers should treat this as read-only — never mutate the references.
 */
export interface CommandContext {
  readonly client: Client
  readonly config: Config
  readonly db: Db
  readonly settingsCache: SettingsCache
  readonly ipcTransport: IpcTransport
  readonly logger: Logger
}
