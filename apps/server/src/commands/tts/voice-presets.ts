import type { AudioFormat } from '@to-much-talker/ai'

export type TtsPlaybackFormat = Extract<AudioFormat, 'mp3' | 'pcm'>

export interface TtsVoicePreset {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly model: string
  readonly voice: string
  readonly format: TtsPlaybackFormat
}

export const GEMINI_TTS_MODEL = 'google/gemini-3.1-flash-tts-preview'
export const GPT_4O_MINI_TTS_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'

export const TTS_VOICE_PRESETS = [
  {
    id: 'gemini-zephyr',
    label: 'Zephyr',
    description: 'Bright, clear, and upbeat.',
    model: GEMINI_TTS_MODEL,
    voice: 'Zephyr',
    format: 'pcm',
  },
  {
    id: 'gemini-puck',
    label: 'Puck',
    description: 'Playful, lively, and conversational.',
    model: GEMINI_TTS_MODEL,
    voice: 'Puck',
    format: 'pcm',
  },
  {
    id: 'gemini-charon',
    label: 'Charon',
    description: 'Deep, steady, and grounded.',
    model: GEMINI_TTS_MODEL,
    voice: 'Charon',
    format: 'pcm',
  },
  {
    id: 'gemini-kore',
    label: 'Kore',
    description: 'Warm, smooth, and balanced.',
    model: GEMINI_TTS_MODEL,
    voice: 'Kore',
    format: 'pcm',
  },
  {
    id: 'gemini-fenrir',
    label: 'Fenrir',
    description: 'Firm, energetic, and direct.',
    model: GEMINI_TTS_MODEL,
    voice: 'Fenrir',
    format: 'pcm',
  },
  {
    id: 'gemini-leda',
    label: 'Leda',
    description: 'Gentle, light, and friendly.',
    model: GEMINI_TTS_MODEL,
    voice: 'Leda',
    format: 'pcm',
  },
  {
    id: 'gemini-orus',
    label: 'Orus',
    description: 'Calm, measured, and resonant.',
    model: GEMINI_TTS_MODEL,
    voice: 'Orus',
    format: 'pcm',
  },
  {
    id: 'gemini-aoede',
    label: 'Aoede',
    description: 'Expressive, bright, and melodic.',
    model: GEMINI_TTS_MODEL,
    voice: 'Aoede',
    format: 'pcm',
  },
  {
    id: 'openai-alloy',
    label: 'Alloy',
    description: 'Neutral, versatile, and natural.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'alloy',
    format: 'mp3',
  },
  {
    id: 'openai-ash',
    label: 'Ash',
    description: 'Relaxed, low, and composed.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'ash',
    format: 'mp3',
  },
  {
    id: 'openai-ballad',
    label: 'Ballad',
    description: 'Warm, expressive, and storytelling-focused.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'ballad',
    format: 'mp3',
  },
  {
    id: 'openai-coral',
    label: 'Coral',
    description: 'Friendly, bright, and approachable.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'coral',
    format: 'mp3',
  },
  {
    id: 'openai-echo',
    label: 'Echo',
    description: 'Clear, crisp, and confident.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'echo',
    format: 'mp3',
  },
  {
    id: 'openai-fable',
    label: 'Fable',
    description: 'Animated, characterful, and narrative.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'fable',
    format: 'mp3',
  },
  {
    id: 'openai-nova',
    label: 'Nova',
    description: 'Energetic, smooth, and modern.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'nova',
    format: 'mp3',
  },
  {
    id: 'openai-onyx',
    label: 'Onyx',
    description: 'Deep, authoritative, and polished.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'onyx',
    format: 'mp3',
  },
  {
    id: 'openai-sage',
    label: 'Sage',
    description: 'Calm, thoughtful, and reassuring.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'sage',
    format: 'mp3',
  },
  {
    id: 'openai-shimmer',
    label: 'Shimmer',
    description: 'Soft, bright, and expressive.',
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'shimmer',
    format: 'mp3',
  },
] as const satisfies readonly TtsVoicePreset[]

export const DEFAULT_TTS_VOICE_PRESET = TTS_VOICE_PRESETS[0]
export const TTS_VOICE_BUTTON_PREFIX = 'tts:user-voice:'

export function findVoicePresetByButtonId(customId: string): TtsVoicePreset | null {
  if (!customId.startsWith(TTS_VOICE_BUTTON_PREFIX)) return null
  return findVoicePresetById(customId.slice(TTS_VOICE_BUTTON_PREFIX.length))
}

export function findVoicePresetById(id: string): TtsVoicePreset | null {
  return TTS_VOICE_PRESETS.find((preset) => preset.id === id) ?? null
}

export function findVoicePresetByVoice(voice: string): TtsVoicePreset | null {
  return TTS_VOICE_PRESETS.find((preset) => preset.voice === voice) ?? null
}

export function defaultVoicePresetForModel(model: string): TtsVoicePreset {
  return TTS_VOICE_PRESETS.find((preset) => preset.model === model) ?? DEFAULT_TTS_VOICE_PRESET
}
