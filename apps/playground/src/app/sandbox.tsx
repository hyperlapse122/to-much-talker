import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { JSX } from 'react'

const TTS_MODELS = [
  { id: 'google/gemini-3.1-flash-tts-preview', label: 'Gemini Flash TTS' },
  { id: 'openai/gpt-4o-mini-tts-2025-12-15', label: 'GPT-4o Mini TTS' },
  { id: 'x-ai/grok-voice-tts-1.0', label: 'Grok Voice TTS 1.0' },
]

function Sandbox(): JSX.Element {
  const [text, setText] = useState('')
  const [model, setModel] = useState(TTS_MODELS[0]?.id ?? '')
  const [voice, setVoice] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const maxChars = 500

  const handleSubmit = async (e: { preventDefault: () => void }): Promise<void> => {
    e.preventDefault()
    if (text.length === 0) return

    setIsLoading(true)
    setError(null)
    setAudioUrl(null)

    try {
      // In dev mode, call server API endpoint (placeholder)
      // The actual TTS synthesis would be done via a server function
      const mockAudio = new Blob(['mock-audio-data'], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(mockAudio)
      setAudioUrl(url)

      // In real implementation:
      // const response = await fetch('/api/tts/synthesize', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ text, model, voice, apiKey }),
      // })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">TTS Sandbox</h2>
        <p className="text-gray-400 mt-1">
          Test text-to-speech synthesis with different models and voices.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="model-select">
            Model
          </label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {TTS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="voice-input">
            Voice (optional)
          </label>
          <input
            id="voice-input"
            type="text"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="e.g. alloy, nova..."
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="api-key-input">
            OpenRouter API Key
          </label>
          <input
            id="api-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="text-input">
            Text ({text.length}/{maxChars})
          </label>
          <textarea
            id="text-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxChars))}
            rows={4}
            placeholder="Enter text to synthesize..."
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm resize-vertical"
          />
          <div className="mt-1 text-xs text-gray-500">
            {text.length > maxChars * 0.8 && (
              <span className="text-yellow-500">Approaching character limit</span>
            )}
          </div>
        </div>

        {error !== null && (
          <div className="p-3 bg-red-950 border border-red-800 rounded-md text-red-300 text-sm">
            {error}
          </div>
        )}

        {audioUrl !== null && (
          <div className="p-4 bg-gray-800 rounded-md">
            <p className="text-sm font-medium mb-2">Audio Output</p>
            <audio controls src={audioUrl} className="w-full">
              <track kind="captions" />
            </audio>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || text.length === 0}
          className="px-4 py-2 bg-white text-black rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Synthesizing...' : 'Synthesize TTS'}
        </button>
      </form>

      <div className="mt-8 p-4 bg-yellow-950 border border-yellow-800 rounded-md">
        <p className="text-sm text-yellow-300">
          Note: This sandbox is for development use only. Set{' '}
          <code className="bg-yellow-900 px-1 rounded">PLAYGROUND_MOCK_OPENROUTER=true</code> to
          avoid real API calls.
        </p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/sandbox')({
  component: Sandbox,
})
