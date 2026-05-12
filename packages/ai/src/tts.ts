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

type UpstreamErrorKind = 'rate_limit' | 'auth' | 'bad_request' | 'server' | 'timeout'

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
  const format = opts.format ?? 'mp3'

  try {
    const signal = AbortSignal.timeout(client.timeout)

    const response = await client.openai.audio.speech.create(
      {
        model: opts.model,
        voice:
          (opts.voice as Parameters<typeof client.openai.audio.speech.create>[0]['voice']) ??
          'alloy',
        input: opts.input,
        response_format: format,
      },
      { signal },
    )

    // Read the raw audio bytes
    const arrayBuffer = await response.arrayBuffer()
    const audio = Buffer.from(arrayBuffer)

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
