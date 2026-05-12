import { getVoiceConnection } from '@discordjs/voice'
import { synthesizeStream } from '@to-much-talker/ai'
import { MessageFlags } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { Logger } from '../../logger.js'
import { getOrCreatePlayer } from '../../voice/index.js'
import type { CommandContext } from '../context.js'
import { getGuildTtsRuntime } from './runtime-cache.js'

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

interface QueueTtsParams {
  readonly guildId: string
  readonly channelId: string
  readonly userId: string
  readonly text: string
  readonly source: 'command' | 'message'
  readonly receivedAtMs?: number
}

interface QueueTtsResult {
  readonly accepted: boolean
  readonly reason?: string
  readonly truncated?: boolean
}

const playbackQueues = new Map<string, Promise<void>>()

function nowMs(): number {
  return performance.now()
}

function playbackTimeoutMs(text: string): number {
  return 15_000 + text.length * 1_500
}

function instrumentFirstAudioByte(
  audio: ReadableStream<Uint8Array>,
  onFirstByte: () => void,
): ReadableStream<Uint8Array> {
  const reader = audio.getReader()
  let firstChunkSeen = false
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read()
      if (result.done) {
        controller.close()
        return
      }

      if (!firstChunkSeen) {
        firstChunkSeen = true
        onFirstByte()
      }
      controller.enqueue(result.value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
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
  const receivedAtMs = nowMs()
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
    receivedAtMs,
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
  const receivedAtMs = params.receivedAtMs ?? nowMs()
  const { text, truncated } = sanitizeText(params.text, MAX_CHARS)
  if (text.length === 0) return { accepted: false, reason: 'Message is empty after sanitization.' }

  const connection = getVoiceConnection(params.guildId)
  if (connection === undefined) {
    return { accepted: false, reason: 'Use `/tts join` before sending TTS messages.' }
  }

  const runtime = await getGuildTtsRuntime(ctx, params.guildId)
  if (runtime === null) {
    return {
      accepted: false,
      reason: 'Set an OpenRouter API key first with `/tts settings api-key`.',
    }
  }

  const previous = playbackQueues.get(params.guildId) ?? Promise.resolve()
  const queuedAtMs = nowMs()
  const task = previous
    .catch(() => undefined)
    .then(() => playQueuedText(log, { ...params, text, receivedAtMs }, runtime, queuedAtMs))
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
      acceptLatencyMs: Math.round(queuedAtMs - receivedAtMs),
    },
    'Queued TTS message',
  )

  return { accepted: true, truncated }
}

async function playQueuedText(
  log: Logger,
  params: QueueTtsParams,
  runtime: Awaited<ReturnType<typeof getGuildTtsRuntime>>,
  queuedAtMs: number,
): Promise<void> {
  if (runtime === null) return
  const connection = getVoiceConnection(params.guildId)
  if (connection === undefined) return

  const synthStartMs = nowMs()
  const result = await synthesizeStream(runtime.client, {
    model: runtime.model,
    input: params.text,
    format: TTS_RESPONSE_FORMAT,
  })

  if (!result.ok) {
    log.error({ guildId: params.guildId, error: result.error.message }, 'TTS synthesis failed')
    return
  }

  const player = getOrCreatePlayer(params.guildId)
  player.attachConnection(connection)
  const playbackStartListener = (): void => {
    const playbackStartMs = nowMs()
    log.info(
      {
        guildId: params.guildId,
        channelId: params.channelId,
        source: params.source,
        queueWaitMs: Math.round(synthStartMs - queuedAtMs),
        synthToPlaybackMs: Math.round(playbackStartMs - synthStartMs),
        totalToPlaybackMs: Math.round(playbackStartMs - (params.receivedAtMs ?? queuedAtMs)),
      },
      'TTS playback started',
    )
  }
  player.once('start', playbackStartListener)
  const audio = instrumentFirstAudioByte(result.value.audio, () => {
    const firstByteMs = nowMs()
    log.info(
      {
        guildId: params.guildId,
        channelId: params.channelId,
        source: params.source,
        synthFirstByteMs: Math.round(firstByteMs - synthStartMs),
        totalToFirstByteMs: Math.round(firstByteMs - (params.receivedAtMs ?? queuedAtMs)),
      },
      'TTS audio stream first byte',
    )
  })
  log.info(
    {
      guildId: params.guildId,
      channelId: params.channelId,
      source: params.source,
      format: result.value.format,
      queueWaitMs: Math.round(synthStartMs - queuedAtMs),
    },
    'Playing streamed TTS message',
  )
  try {
    await player.playFromWebStream(audio, TTS_RESPONSE_FORMAT, playbackTimeoutMs(params.text))
  } finally {
    player.off('start', playbackStartListener)
  }
  log.info({ guildId: params.guildId, source: params.source }, 'TTS playback complete')
}
