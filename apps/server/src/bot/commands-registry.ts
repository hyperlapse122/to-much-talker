import type { Config } from '@to-much-talker/config'
import {
  REST,
  Routes,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from 'discord.js'
import { logger } from '../logger.js'

const log = logger.child({ component: 'commands-registry' })

/**
 * Build the `/tts` slash command tree.
 *
 * Subcommands (see plan / AGENTS for full spec):
 *   join, leave, say, skip, clear, stats, help, settings, setup
 *
 * Localized names/descriptions land in later tasks via `locale-bridge`;
 * for the scaffold we register English-only strings. The `settings`
 * subcommand here is a stub — its option tree will be filled by Task 21.
 */
function buildTtsCommand(): SlashCommandBuilder {
  const tts = new SlashCommandBuilder().setName('tts').setDescription('Text-to-speech commands')
  const userSettings = new SlashCommandSubcommandGroupBuilder()
    .setName('user')
    .setDescription('View and update your TTS preferences')
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName('model')
        .setDescription('Choose your preferred TTS voice for this server'),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName('voice')
        .setDescription('Choose your preferred TTS voice for this server'),
    )

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('join')
      .setDescription('Join your voice channel and start reading messages'),
  )

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder().setName('leave').setDescription('Leave the voice channel'),
  )

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('say')
      .setDescription('Queue a text-to-speech message')
      .addStringOption((opt) =>
        opt.setName('text').setDescription('Text to speak').setRequired(true).setMaxLength(2000),
      ),
  )

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('skip')
      .setDescription('Skip the current TTS track'),
  )

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder().setName('clear').setDescription('Clear the TTS queue'),
  )

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder().setName('stats').setDescription('Show TTS statistics'),
  )

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('help')
      .setDescription('Show help for TTS commands'),
  )

  tts.addSubcommandGroup(
    new SlashCommandSubcommandGroupBuilder()
      .setName('settings')
      .setDescription('View and update settings')
      .addSubcommand(
        new SlashCommandSubcommandBuilder()
          .setName('api-key')
          .setDescription('Set the OpenRouter API key for this server')
          .addStringOption((opt) =>
            opt
              .setName('key')
              .setDescription('OpenRouter API key')
              .setRequired(true)
              .setMinLength(1),
          ),
      ),
  )

  tts.addSubcommandGroup(userSettings)

  tts.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName('setup')
      .setDescription('Run the server setup wizard'),
  )

  return tts as SlashCommandBuilder
}

/**
 * Register all slash commands GLOBALLY against the Discord REST API.
 *
 * Global registration (vs. per-guild) is intentional: easier to operate,
 * propagates within ~an hour, and avoids stale per-guild state across
 * server joins/leaves. Per-guild registration is forbidden by Task 13's spec.
 */
export async function registerCommands(config: Config): Promise<void> {
  const rest = new REST().setToken(config.DISCORD_TOKEN)
  const commands = [buildTtsCommand().toJSON()]

  try {
    log.info('Registering slash commands globally...')
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands })
    log.info({ count: commands.length }, 'Slash commands registered successfully')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error({ error: message }, 'Failed to register commands')
    throw error
  }
}
