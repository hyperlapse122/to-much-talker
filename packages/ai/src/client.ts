import OpenAI from 'openai'

export interface OpenRouterClientOptions {
  readonly apiKey: string
  readonly baseURL?: string
  readonly timeout?: number
}

export class OpenRouterClient {
  readonly #client: OpenAI
  readonly timeout: number

  constructor(opts: OpenRouterClientOptions) {
    this.#client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? 'https://openrouter.ai/api/v1',
    })
    this.timeout = opts.timeout ?? 30_000
  }

  get openai(): OpenAI {
    return this.#client
  }
}
