# AGENTS — @to-much-talker/ai

This package is the **ONLY** place that imports `openai` SDK or makes direct HTTP calls to OpenRouter.

## Key Rules

- NEVER log API keys — `OpenRouterClient` takes `apiKey` as a constructor param; it stays private
- ALWAYS check `result.ok` before using TTS audio — never assume success
- `synthesize()` wraps errors as `UpstreamError` — callers must check `error.code`
- 429 (rate_limit) errors are RETRYABLE — callers should implement backoff
- TTS audio is returned as a `Buffer` — caller is responsible for playback/streaming

## TTS Models (OpenRouter)

- `google/gemini-2.5-flash-preview-tts` — Gemini Flash TTS
- `openai/gpt-4o-mini-tts` — GPT-4o Mini TTS
- Both use OpenAI-compatible `/audio/speech` endpoint

## OpenRouter TTS via openai SDK

```typescript
const client = new OpenRouterClient({ apiKey: 'sk-or-...' })
const result = await synthesize(client, {
  model: 'google/gemini-2.5-flash-preview-tts',
  input: 'Hello, world!',
  format: 'mp3',
})
```

## TanStack AI Note

TanStack AI is NOT used in this package. It's for playground chat features only (Task 25).
