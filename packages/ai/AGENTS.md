# AGENTS — @to-much-talker/ai

This package is the **ONLY** place that imports `@openrouter/sdk` or makes direct HTTP calls to OpenRouter.

## Key Rules

- NEVER log API keys — `OpenRouterClient` takes `apiKey` as a constructor param; it stays private
- ALWAYS check `result.ok` before using TTS audio — never assume success
- `synthesize()` wraps errors as `UpstreamError` — callers must check `error.code`
- 429 (rate_limit) errors are RETRYABLE — callers should implement backoff
- TTS audio is returned as a `Buffer` — caller is responsible for playback/streaming

## TTS Models (OpenRouter)

- `google/gemini-3.1-flash-tts-preview` — Gemini Flash TTS
- Use the OpenRouter SDK TTS API with `responseFormat: 'pcm'` for Gemini TTS playback.

## OpenRouter TTS via OpenRouter SDK

```typescript
const client = new OpenRouterClient({ apiKey: 'sk-or-...' })
const result = await synthesize(client, {
  model: 'google/gemini-3.1-flash-tts-preview',
  input: 'Hello, world!',
  voice: 'Zephyr',
  format: 'pcm',
})
```

## TanStack AI Note

TanStack AI is NOT used in this package. It's for playground chat features only (Task 25).
