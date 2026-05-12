import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { JSX } from 'react'

interface GuildSettings {
  guildId: string
  defaultModel: string
  maxChars: number
  locale: string
  idleLeaveOnEmpty: boolean
}

function Inspector(): JSX.Element {
  const [guildId, setGuildId] = useState('')
  const [settings, setSettings] = useState<GuildSettings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (guildId.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      // Placeholder: in real implementation, fetch from API
      setSettings({
        guildId,
        defaultModel: 'google/gemini-2.5-flash-preview-tts',
        maxChars: 500,
        locale: 'en',
        idleLeaveOnEmpty: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings Inspector</h2>
        <p className="text-gray-400 mt-1">View guild settings and audit logs (read-only).</p>
      </div>

      <form onSubmit={handleLookup} className="flex gap-3">
        <input
          type="text"
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          placeholder="Guild ID (snowflake)"
          pattern="^\d{17,20}$"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm font-mono"
        />
        <button
          type="submit"
          disabled={isLoading || guildId.length === 0}
          className="px-4 py-2 bg-white text-black rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Lookup'}
        </button>
      </form>

      {error !== null && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-md text-red-300 text-sm">
          {error}
        </div>
      )}

      {settings !== null && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Guild Settings: {settings.guildId}</h3>
          <div className="grid grid-cols-2 gap-4">
            <SettingsRow label="Default Model" value={settings.defaultModel} />
            <SettingsRow label="Max Characters" value={String(settings.maxChars)} />
            <SettingsRow label="Locale" value={settings.locale} />
            <SettingsRow label="Idle Leave on Empty" value={String(settings.idleLeaveOnEmpty)} />
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-950 border border-blue-800 rounded-md">
        <p className="text-sm text-blue-300">
          Note: This inspector requires{' '}
          <code className="bg-blue-900 px-1 rounded">DATABASE_URL</code> to be configured. Settings
          are read-only by default.
        </p>
      </div>
    </div>
  )
}

function SettingsRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="p-3 bg-gray-800 rounded-md">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-mono">{value}</div>
    </div>
  )
}

export const Route = createFileRoute('/inspector')({
  component: Inspector,
})
