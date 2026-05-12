import type { CreateAudioSpeechRequest } from '@openrouter/sdk/models/operations'
import { describe, expect, it } from 'vitest'
import { OpenRouterClient, type OpenRouterSdk } from './client.js'
import { synthesize } from './tts.js'

function audioStream(bytes: readonly number[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from(bytes))
      controller.close()
    },
  })
}

describe('synthesize', () => {
  it('calls OpenRouter TTS with the requested speech settings', async () => {
    let seenRequest: CreateAudioSpeechRequest | undefined
    let seenTimeout: number | undefined
    const sdk: OpenRouterSdk = {
      tts: {
        async createSpeech(request, options) {
          seenRequest = request
          seenTimeout = options?.timeoutMs
          return audioStream([1, 2, 3])
        },
      },
      models: {
        async list() {
          return { data: [] }
        },
      },
    }
    const client = new OpenRouterClient({ apiKey: 'test-key', timeout: 1234, sdk })

    const result = await synthesize(client, {
      model: 'google/gemini-3.1-flash-tts-preview',
      input: 'hello',
      voice: 'Zephyr',
      format: 'pcm',
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? [...result.value.audio] : []).toEqual([1, 2, 3])
    expect(result.ok ? result.value.format : undefined).toBe('pcm')
    expect(seenTimeout).toBe(1234)
    expect(seenRequest).toEqual({
      speechRequest: {
        model: 'google/gemini-3.1-flash-tts-preview',
        voice: 'Zephyr',
        input: 'hello',
        responseFormat: 'pcm',
      },
    })
  })

  it('rejects formats not supported by OpenRouter TTS', async () => {
    let called = false
    const sdk: OpenRouterSdk = {
      tts: {
        async createSpeech() {
          called = true
          return audioStream([])
        },
      },
      models: {
        async list() {
          return { data: [] }
        },
      },
    }
    const client = new OpenRouterClient({ apiKey: 'test-key', sdk })

    const result = await synthesize(client, {
      model: 'google/gemini-3.1-flash-tts-preview',
      input: 'hello',
      format: 'wav',
    })

    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })
})
