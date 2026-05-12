import { Client, Events, GatewayIntentBits } from 'discord.js'
import type { Config } from '@to-much-talker/config'
import { logger } from '../logger.js'

/**
 * Create a configured Discord.js Client.
 *
 * Intents are the minimum required for the bot:
 * - Guilds:            receive guildCreate / guildDelete + member info
 * - GuildVoiceStates:  required by @discordjs/voice to track voice channels
 * - GuildMessages:     receive message events for "auto-read text channel" feature
 * - MessageContent:    read message body text for TTS pipeline (privileged intent —
 *                      must be enabled in the Discord Developer Portal)
 *
 * `_config` is currently unused but kept on the signature so future tasks
 * (presence, partials, ws options) can read from it without a breaking change.
 */
export function createClient(_config: Config): Client {
  // _config is reserved for future configuration (presence, partials, ws options).
  // Reference it explicitly so eslint's `no-unused-vars` (args: 'after-used' default)
  // does not flag the parameter; this keeps the signature stable for forward compat.
  void _config
  const log = logger.child({ component: 'discord-client' })

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  })

  client.once(Events.ClientReady, (c) => {
    log.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, 'Discord client ready')
  })

  client.on('warn', (message) => {
    log.warn({ message }, 'Discord warning')
  })

  client.on('error', (error) => {
    log.error({ error: error.message }, 'Discord client error')
  })

  return client
}
