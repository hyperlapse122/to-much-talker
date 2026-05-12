import type { Result } from '@to-much-talker/shared'
import { UpstreamError } from '@to-much-talker/shared'
import type { OpenRouterClient } from './client.js'

export type AudioFormat = 'mp3' | 'wav' | 'opus' | 'pcm' | 'aac'

export interface TtsSynthesizeOptions {
  readonly model: string
  readonly voice?: string
  readonly input: string
  readonly format?: AudioFormat
}

export interface TtsSynthesizeResult {
  readonly audio: Buffer
  readonly format: AudioFormat
}

export interface TtsStreamResult {
  readonly audio: ReadableStream<Uint8Array>
  readonly format: AudioFormat
}

type OpenRouterAudioFormat = Extract<AudioFormat, 'mp3' | 'pcm'>
type UpstreamErrorKind = 'rate_limit' | 'auth' | 'bad_request' | 'server' | 'timeout'

function toOpenRouterAudioFormat(format: AudioFormat): OpenRouterAudioFormat | null {
  if (format === 'mp3' || format === 'pcm') return format
  return null
}

function classifyError(err: unknown): UpstreamErrorKind {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('timeout') || msg.includes('abort')) return 'timeout'
    if (msg.includes('401') || msg.includes('unauthorized')) return 'auth'
    if (msg.includes('429') || msg.includes('rate limit')) return 'rate_limit'
    if (msg.includes('400') || msg.includes('bad request')) return 'bad_request'
  }
  return 'server'
}

export async function synthesize(
  client: OpenRouterClient,
  opts: TtsSynthesizeOptions,
): Promise<Result<TtsSynthesizeResult, UpstreamError>> {
  const streamed = await synthesizeStream(client, opts)
  if (!streamed.ok) return streamed

  const arrayBuffer = await new Response(streamed.value.audio).arrayBuffer()
  const audio = Buffer.from(arrayBuffer)

  return { ok: true, value: { audio, format: streamed.value.format } }
}

export async function synthesizeStream(
  client: OpenRouterClient,
  opts: TtsSynthesizeOptions,
): Promise<Result<TtsStreamResult, UpstreamError>> {
  const format = opts.format ?? 'mp3'
  const responseFormat = toOpenRouterAudioFormat(format)
  if (responseFormat === null) {
    return {
      ok: false,
      error: new UpstreamError(`TTS synthesis failed (bad_request): unsupported format ${format}`),
    }
  }

  try {
    const audio = await client.sdk.tts.createSpeech(
      {
        speechRequest: {
          model: opts.model,
          voice: opts.voice ?? 'Zephyr',
          input: opts.input,
          responseFormat,
        },
      },
      { timeoutMs: client.timeout },
    )

    return { ok: true, value: { audio, format } }
  } catch (cause) {
    const kind = classifyError(cause)
    return {
      ok: false,
      error: new UpstreamError(
        `TTS synthesis failed (${kind}): ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
    }
  }
}
