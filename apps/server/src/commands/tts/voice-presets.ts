import type { AudioFormat } from '@to-much-talker/ai'
import { m } from '@to-much-talker/i18n'

export type TtsPlaybackFormat = Extract<AudioFormat, 'mp3' | 'pcm'>

export interface TtsVoicePreset {
  readonly id: string
  readonly label: string
  readonly description: () => string
  readonly model: string
  readonly voice: string
  readonly format: TtsPlaybackFormat
}

export const GEMINI_TTS_MODEL = 'google/gemini-3.1-flash-tts-preview'
export const GPT_4O_MINI_TTS_MODEL = 'openai/gpt-4o-mini-tts-2025-12-15'
export const GROK_VOICE_TTS_MODEL = 'x-ai/grok-voice-tts-1.0'

export const TTS_VOICE_PRESETS = [
  {
    id: 'gemini-zephyr',
    label: 'Zephyr',
    description: m.tts_voice_description_gemini_zephyr,
    model: GEMINI_TTS_MODEL,
    voice: 'Zephyr',
    format: 'pcm',
  },
  {
    id: 'gemini-puck',
    label: 'Puck',
    description: m.tts_voice_description_gemini_puck,
    model: GEMINI_TTS_MODEL,
    voice: 'Puck',
    format: 'pcm',
  },
  {
    id: 'gemini-charon',
    label: 'Charon',
    description: m.tts_voice_description_gemini_charon,
    model: GEMINI_TTS_MODEL,
    voice: 'Charon',
    format: 'pcm',
  },
  {
    id: 'gemini-kore',
    label: 'Kore',
    description: m.tts_voice_description_gemini_kore,
    model: GEMINI_TTS_MODEL,
    voice: 'Kore',
    format: 'pcm',
  },
  {
    id: 'gemini-fenrir',
    label: 'Fenrir',
    description: m.tts_voice_description_gemini_fenrir,
    model: GEMINI_TTS_MODEL,
    voice: 'Fenrir',
    format: 'pcm',
  },
  {
    id: 'gemini-leda',
    label: 'Leda',
    description: m.tts_voice_description_gemini_leda,
    model: GEMINI_TTS_MODEL,
    voice: 'Leda',
    format: 'pcm',
  },
  {
    id: 'gemini-orus',
    label: 'Orus',
    description: m.tts_voice_description_gemini_orus,
    model: GEMINI_TTS_MODEL,
    voice: 'Orus',
    format: 'pcm',
  },
  {
    id: 'gemini-aoede',
    label: 'Aoede',
    description: m.tts_voice_description_gemini_aoede,
    model: GEMINI_TTS_MODEL,
    voice: 'Aoede',
    format: 'pcm',
  },
  {
    id: 'openai-alloy',
    label: 'Alloy',
    description: m.tts_voice_description_openai_alloy,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'alloy',
    format: 'mp3',
  },
  {
    id: 'openai-ash',
    label: 'Ash',
    description: m.tts_voice_description_openai_ash,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'ash',
    format: 'mp3',
  },
  {
    id: 'openai-ballad',
    label: 'Ballad',
    description: m.tts_voice_description_openai_ballad,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'ballad',
    format: 'mp3',
  },
  {
    id: 'openai-coral',
    label: 'Coral',
    description: m.tts_voice_description_openai_coral,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'coral',
    format: 'mp3',
  },
  {
    id: 'openai-echo',
    label: 'Echo',
    description: m.tts_voice_description_openai_echo,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'echo',
    format: 'mp3',
  },
  {
    id: 'openai-fable',
    label: 'Fable',
    description: m.tts_voice_description_openai_fable,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'fable',
    format: 'mp3',
  },
  {
    id: 'openai-nova',
    label: 'Nova',
    description: m.tts_voice_description_openai_nova,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'nova',
    format: 'mp3',
  },
  {
    id: 'openai-onyx',
    label: 'Onyx',
    description: m.tts_voice_description_openai_onyx,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'onyx',
    format: 'mp3',
  },
  {
    id: 'openai-sage',
    label: 'Sage',
    description: m.tts_voice_description_openai_sage,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'sage',
    format: 'mp3',
  },
  {
    id: 'openai-shimmer',
    label: 'Shimmer',
    description: m.tts_voice_description_openai_shimmer,
    model: GPT_4O_MINI_TTS_MODEL,
    voice: 'shimmer',
    format: 'mp3',
  },
  {
    id: 'grok-eve',
    label: 'Eve',
    description: m.tts_voice_description_grok_eve,
    model: GROK_VOICE_TTS_MODEL,
    voice: 'eve',
    format: 'mp3',
  },
  {
    id: 'grok-ara',
    label: 'Ara',
    description: m.tts_voice_description_grok_ara,
    model: GROK_VOICE_TTS_MODEL,
    voice: 'ara',
    format: 'mp3',
  },
  {
    id: 'grok-rex',
    label: 'Rex',
    description: m.tts_voice_description_grok_rex,
    model: GROK_VOICE_TTS_MODEL,
    voice: 'rex',
    format: 'mp3',
  },
  {
    id: 'grok-sal',
    label: 'Sal',
    description: m.tts_voice_description_grok_sal,
    model: GROK_VOICE_TTS_MODEL,
    voice: 'sal',
    format: 'mp3',
  },
  {
    id: 'grok-leo',
    label: 'Leo',
    description: m.tts_voice_description_grok_leo,
    model: GROK_VOICE_TTS_MODEL,
    voice: 'leo',
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
