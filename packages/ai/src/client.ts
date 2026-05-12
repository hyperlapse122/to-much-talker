import { OpenRouter } from '@openrouter/sdk'
import type { ModelsListResponse } from '@openrouter/sdk/models'
import type { CreateAudioSpeechRequest, GetModelsRequest } from '@openrouter/sdk/models/operations'

interface OpenRouterRequestOptions {
  readonly timeoutMs?: number
}

const sdkDebugLoggingDisabled = true

const disabledOpenRouterDebugLogger = {
  group(): void {
    void sdkDebugLoggingDisabled
  },
  groupEnd(): void {
    void sdkDebugLoggingDisabled
  },
  log(): void {
    void sdkDebugLoggingDisabled
  },
}

export interface OpenRouterSdk {
  readonly tts: {
    createSpeech(
      request: CreateAudioSpeechRequest,
      options?: OpenRouterRequestOptions,
    ): Promise<ReadableStream<Uint8Array>>
  }
  readonly models: {
    list(
      request?: GetModelsRequest,
      options?: OpenRouterRequestOptions,
    ): Promise<ModelsListResponse>
  }
}

export interface OpenRouterClientOptions {
  readonly apiKey: string
  readonly baseURL?: string
  readonly timeout?: number
  readonly sdk?: OpenRouterSdk
}

export class OpenRouterClient {
  readonly sdk: OpenRouterSdk
  readonly timeout: number

  constructor(opts: OpenRouterClientOptions) {
    this.timeout = opts.timeout ?? 30_000
    this.sdk =
      opts.sdk ??
      new OpenRouter({
        apiKey: opts.apiKey,
        serverURL: opts.baseURL,
        timeoutMs: this.timeout,
        debugLogger: disabledOpenRouterDebugLogger,
      })
  }
}
