import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { type JSX, useEffect, useState } from 'react'
import { NotFoundPage } from '@/components/NotFoundPage.js'
import { SearchDialog } from '@/components/SearchDialog.js'
import { Sidebar } from '@/components/Sidebar.js'
import '@/styles/globals.css'

function RootLayout(): JSX.Element {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((current) => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="text-base font-semibold tracking-tight text-foreground" to="/">
            To Much Talker
          </Link>

          <button
            aria-label="Open search"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setSearchOpen(true)}
            type="button"
          >
            <Search aria-hidden="true" className="size-4" />
            <span>Search docs</span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <Sidebar />
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})
