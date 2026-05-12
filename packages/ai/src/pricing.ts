export interface ModelPricing {
  readonly perChar?: number // cost per character in microdollars
  readonly perToken?: number // cost per token in microdollars (fallback)
}

// Default pricing estimates for known OpenRouter TTS models
// These are rough estimates — actual costs from API response headers take precedence
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'google/gemini-3.1-flash-tts-preview': { perChar: 1.0 }, // ~$0.000001 per char
}

export interface EstimateCostOptions {
  readonly model: string
  readonly text: string
  readonly pricing?: ModelPricing
}

// Returns cost in microdollars (to avoid floating point issues)
export function estimateCost(opts: EstimateCostOptions): number {
  const pricing = opts.pricing ?? DEFAULT_PRICING[opts.model] ?? { perChar: 1.0 }
  const charCount = opts.text.length

  if (pricing.perChar !== undefined) {
    return Math.ceil(charCount * pricing.perChar)
  }

  // Rough char-to-token approximation (4 chars per token)
  if (pricing.perToken !== undefined) {
    const estimatedTokens = Math.ceil(charCount / 4)
    return Math.ceil(estimatedTokens * pricing.perToken)
  }

  return 0
}
