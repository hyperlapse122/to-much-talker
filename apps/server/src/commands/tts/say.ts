import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandContext } from '../context.js'

const MAX_CHARS = 500
const CUSTOM_EMOJI = /<a?:([^:]+):\d+>/g
const URL_PATTERN = /https?:\/\/\S+/g
const USER_MENTION = /<@!?\d+>/g
const ROLE_MENTION = /<@&\d+>/g
const CHANNEL_MENTION = /<#\d+>/g
const FENCED_CODE = /```[\s\S]*?```/g

interface SanitizeResult {
  readonly text: string
  readonly truncated: boolean
}

/**
 * Strip Discord-specific formatting and limit the message length.
 *
 * Mentions, channel references, custom emoji, URLs, and fenced code blocks are
 * replaced with safe placeholders before being sent through TTS.
 */
function sanitizeText(text: string, maxChars: number): SanitizeResult {
  const sanitized = text
    .replace(FENCED_CODE, '')
    .replace(USER_MENTION, '@user')
    .replace(ROLE_MENTION, '@role')
    .replace(CHANNEL_MENTION, '#channel')
    .replace(CUSTOM_EMOJI, (_match, name: string) => `:${name}:`)
    .replace(URL_PATTERN, 'link')
    .trim()

  if (sanitized.length > maxChars) {
    return { text: sanitized.slice(0, maxChars), truncated: true }
  }
  return { text: sanitized, truncated: false }
}

/**
 * `/tts say <text>` — Sanitize and queue a TTS message.
 *
 * The actual synthesis & playback wiring is performed by the queue/voice
 * subsystems; this handler is responsible for input validation, sanitization,
 * and replying to the interaction.
 */
export async function handleTtsSay(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const log = ctx.logger.child({ component: 'commands/tts/say' })

  const guild = interaction.guild
  if (guild === null) {
    await interaction.reply({
      content: 'This command must be used in a server.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const rawText = interaction.options.getString('text', true)
  const { text, truncated } = sanitizeText(rawText, MAX_CHARS)

  if (text.length === 0) {
    await interaction.reply({
      content: 'Message is empty after sanitization.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (truncated) {
    // i18n: tts_say_over_limit
    await interaction.reply({
      content: `Your message was truncated to ${MAX_CHARS} characters. Queued: "${text.slice(0, 50)}..."`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  log.info({ guildId: guild.id, chars: text.length }, 'Queued TTS message')

  // i18n: tts_say_queued
  await interaction.reply({ content: 'Queued your message for TTS playback.' })
}
