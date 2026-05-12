import { createFileRoute, Link } from '@tanstack/react-router'
import type { JSX } from 'react'

function HomePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">To Much Talker — Dev Playground</h2>
        <p className="text-muted-foreground mt-2">
          Development tools for testing TTS and inspecting bot settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/sandbox"
          className="block p-6 rounded-lg border border-border hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">TTS Sandbox</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Test TTS synthesis with different models and voices.
          </p>
        </Link>

        <Link
          to="/inspector"
          className="block p-6 rounded-lg border border-border hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">Settings Inspector</h3>
          <p className="text-sm text-muted-foreground mt-1">
            View and inspect guild settings and audit logs.
          </p>
        </Link>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>This playground is for development use only. Bound to localhost by default.</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: HomePage,
})
