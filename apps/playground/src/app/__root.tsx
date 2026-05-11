import { createRootRoute, Outlet } from '@tanstack/react-router'
import type { JSX } from 'react'
import '../styles/globals.css'

function RootLayout(): JSX.Element {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>To Much Talker — Dev Playground</title>
      </head>
      <body>
        <div className="min-h-screen bg-background text-foreground">
          <nav className="border-b border-border p-4">
            <div className="max-w-6xl mx-auto flex items-center gap-6">
              <h1 className="text-lg font-semibold">TMT Playground</h1>
              <div className="flex gap-4 text-sm">
                <a href="/" className="text-muted-foreground hover:text-foreground">
                  Home
                </a>
                <a href="/sandbox" className="text-muted-foreground hover:text-foreground">
                  TTS Sandbox
                </a>
                <a href="/inspector" className="text-muted-foreground hover:text-foreground">
                  Settings Inspector
                </a>
              </div>
            </div>
          </nav>
          <main className="max-w-6xl mx-auto p-6">
            <Outlet />
          </main>
        </div>
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
