import { getVoiceConnection } from '@discordjs/voice'
import { OpenRouterClient, synthesize } from '@to-much-talker/ai'
import { decrypt, parseMasterKey } from '@to-much-talker/crypto'
import { eq, pg, sqlite } from '@to-much-talker/db'
import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Logger } from '../../logger.js'
import { getOrCreatePlayer } from '../../voice/index.js'
import type { CommandContext } from '../context.js'

const MAX_CHARS = 500
const CUSTOM_EMOJI = /<a?:([^:]+):\d+>/g
const URL_PATTERN = /https?:\/\/\S+/g
const USER_MENTION = /<@!?\d+>/g
const ROLE_MENTION = /<@&\d+>/g
const CHANNEL_MENTION = /<#\d+>/g
const FENCED_CODE = /```[\s\S]*?```/g
const TTS_RESPONSE_FORMAT = 'pcm'

interface SanitizeResult {
  readonly text: string
  readonly truncated: boolean
}

interface StoredApiKey {
  readonly encrypted: string
  readonly iv: string
  readonly authTag: string
  readonly version: number
}

interface QueueTtsParams {
  readonly guildId: string
  readonly channelId: string
  readonly userId: string
  readonly text: string
  readonly source: 'command' | 'message'
}

interface QueueTtsResult {
  readonly accepted: boolean
  readonly reason?: string
  readonly truncated?: boolean
}

const playbackQueues = new Map<string, Promise<void>>()

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

  const queued = await enqueueTtsText(ctx, {
    guildId: guild.id,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    text,
    source: 'command',
  })

  if (!queued.accepted) {
    await interaction.reply({
      content: queued.reason ?? 'Could not queue TTS playback.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.reply({
    content: 'Queued your message for TTS playback.',
    flags: MessageFlags.Ephemeral,
  })
}

export async function enqueueTtsText(
  ctx: CommandContext,
  params: QueueTtsParams,
): Promise<QueueTtsResult> {
  const log = ctx.logger.child({ component: 'tts/playback-queue' })
  const { text, truncated } = sanitizeText(params.text, MAX_CHARS)
  if (text.length === 0) return { accepted: false, reason: 'Message is empty after sanitization.' }

  const connection = getVoiceConnection(params.guildId)
  if (connection === undefined) {
    return { accepted: false, reason: 'Use `/tts join` before sending TTS messages.' }
  }

  const apiKey = await loadGuildApiKey(params.guildId, ctx)
  if (apiKey === null) {
    return {
      accepted: false,
      reason: 'Set an OpenRouter API key first with `/tts settings api-key`.',
    }
  }

  const model = await loadGuildDefaultModel(params.guildId, ctx)
  const previous = playbackQueues.get(params.guildId) ?? Promise.resolve()
  const task = previous
    .catch(() => undefined)
    .then(() => playQueuedText(log, { ...params, text }, apiKey, model))
    .finally(() => {
      if (playbackQueues.get(params.guildId) === task) {
        playbackQueues.delete(params.guildId)
      }
    })

  playbackQueues.set(params.guildId, task)
  void task.catch((error: unknown) => {
    log.error(
      { guildId: params.guildId, error: error instanceof Error ? error.message : String(error) },
      'Queued TTS playback failed',
    )
  })

  log.info(
    {
      guildId: params.guildId,
      channelId: params.channelId,
      source: params.source,
      chars: text.length,
    },
    'Queued TTS message',
  )

  return { accepted: true, truncated }
}

async function playQueuedText(
  log: Logger,
  params: QueueTtsParams,
  apiKey: string,
  model: string,
): Promise<void> {
  const connection = getVoiceConnection(params.guildId)
  if (connection === undefined) return

  const client = new OpenRouterClient({ apiKey })
  const result = await synthesize(client, {
    model,
    input: params.text,
    format: TTS_RESPONSE_FORMAT,
  })

  if (!result.ok) {
    log.error({ guildId: params.guildId, error: result.error.message }, 'TTS synthesis failed')
    return
  }

  const player = getOrCreatePlayer(params.guildId)
  player.attachConnection(connection)
  log.info(
    {
      guildId: params.guildId,
      channelId: params.channelId,
      source: params.source,
      bytes: result.value.audio.length,
      format: result.value.format,
    },
    'Playing TTS message',
  )
  await player.playFromBuffer(result.value.audio, TTS_RESPONSE_FORMAT)
  log.info({ guildId: params.guildId, source: params.source }, 'TTS playback complete')
}

async function loadGuildDefaultModel(guildId: string, ctx: CommandContext): Promise<string> {
  if (ctx.db.dialect === 'sqlite') {
    const row = ctx.db.db
      .select({ defaultModel: sqlite.guildSettings.defaultModel })
      .from(sqlite.guildSettings)
      .where(eq(sqlite.guildSettings.guildId, guildId))
      .get()
    return row?.defaultModel ?? 'google/gemini-3.1-flash-tts-preview'
  }

  const rows = await ctx.db.db
    .select({ defaultModel: pg.guildSettings.defaultModel })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)
  return rows[0]?.defaultModel ?? 'google/gemini-3.1-flash-tts-preview'
}

async function loadGuildApiKey(guildId: string, ctx: CommandContext): Promise<string | null> {
  const stored =
    ctx.db.dialect === 'sqlite' ? loadSqliteApiKey(guildId, ctx) : await loadPgApiKey(guildId, ctx)
  if (stored === null) return null

  const masterKey = parseMasterKey(ctx.config.MASTER_ENC_KEY)
  if (!masterKey.ok) {
    throw masterKey.error
  }

  const decrypted = decrypt(
    {
      ciphertext: Buffer.from(stored.encrypted, 'base64'),
      iv: Buffer.from(stored.iv, 'base64'),
      authTag: Buffer.from(stored.authTag, 'base64'),
    },
    masterKey.value,
  )

  if (!decrypted.ok) {
    throw decrypted.error
  }

  return decrypted.value
}

function loadSqliteApiKey(guildId: string, ctx: CommandContext): StoredApiKey | null {
  if (ctx.db.dialect !== 'sqlite') return null
  const row = ctx.db.db
    .select({
      encrypted: sqlite.guildSettings.apiKeyEncrypted,
      iv: sqlite.guildSettings.apiKeyIv,
      authTag: sqlite.guildSettings.apiKeyAuthTag,
      version: sqlite.guildSettings.apiKeyVersion,
    })
    .from(sqlite.guildSettings)
    .where(eq(sqlite.guildSettings.guildId, guildId))
    .get()

  if (
    row === undefined ||
    row.encrypted === null ||
    row.iv === null ||
    row.authTag === null ||
    row.version === null
  ) {
    return null
  }

  return { encrypted: row.encrypted, iv: row.iv, authTag: row.authTag, version: row.version }
}

async function loadPgApiKey(guildId: string, ctx: CommandContext): Promise<StoredApiKey | null> {
  if (ctx.db.dialect !== 'pg') return null
  const rows = await ctx.db.db
    .select({
      encrypted: pg.guildSettings.apiKeyEncrypted,
      iv: pg.guildSettings.apiKeyIv,
      authTag: pg.guildSettings.apiKeyAuthTag,
      version: pg.guildSettings.apiKeyVersion,
    })
    .from(pg.guildSettings)
    .where(eq(pg.guildSettings.guildId, guildId))
    .limit(1)

  const row = rows[0]
  if (
    row === undefined ||
    row.encrypted === null ||
    row.iv === null ||
    row.authTag === null ||
    row.version === null
  ) {
    return null
  }

  return { encrypted: row.encrypted, iv: row.iv, authTag: row.authTag, version: row.version }
}
