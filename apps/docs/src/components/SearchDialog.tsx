import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { type JSX, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils.js'

export interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PagefindResultData {
  url: string
  title: string
  excerpt: string
}

interface PagefindResult {
  id: string
  data: () => Promise<PagefindResultData>
}

interface PagefindSearchResponse {
  results: PagefindResult[]
}

interface PagefindModule {
  search: (query: string) => Promise<PagefindSearchResponse | null>
}

interface SearchResult {
  id: string
  url: string
  title: string
  excerpt: string
}

type SearchStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

const minimumQueryLength = 2
const searchDebounceMs = 200

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

async function loadPagefind(): Promise<PagefindModule | null> {
  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL)

  try {
    const pagefindModule: PagefindModule = await import(
      /* @vite-ignore */ `${baseUrl}pagefind/pagefind.js`
    )

    return pagefindModule
  } catch (error: unknown) {
    if (import.meta.env.DEV === false) {
      // eslint-disable-next-line no-console -- Production Pagefind load failures should be visible.
      console.error('Failed to load Pagefind search runtime.', error)
    }

    return null
  }
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps): JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const pagefindRef = useRef<PagefindModule | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')

  useEffect(() => {
    if (!open) {
      return
    }

    const focusId = window.setTimeout(() => inputRef.current?.focus(), 0)

    return () => window.clearTimeout(focusId)
  }, [open])

  useEffect(() => {
    if (!open || pagefindRef.current !== null || status === 'loading') {
      return
    }

    let cancelled = false
    setStatus('loading')

    void loadPagefind().then((pagefind) => {
      if (cancelled) {
        return
      }

      pagefindRef.current = pagefind
      setStatus(pagefind === null ? 'unavailable' : 'ready')
    })

    return () => {
      cancelled = true
    }
  }, [open, status])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      return
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open || query.trim().length < minimumQueryLength) {
      setResults([])
      return
    }

    const pagefind = pagefindRef.current

    if (pagefind === null) {
      return
    }

    let cancelled = false
    const searchId = window.setTimeout(() => {
      void pagefind.search(query).then(async (response) => {
        if (cancelled || response === null) {
          return
        }

        const nextResults = await Promise.all(
          response.results.slice(0, 8).map(async (result) => {
            const data = await result.data()

            return {
              id: result.id,
              url: data.url,
              title: data.title,
              excerpt: data.excerpt,
            } satisfies SearchResult
          }),
        )

        if (!cancelled) {
          setResults(nextResults)
        }
      })
    }, searchDebounceMs)

    return () => {
      cancelled = true
      window.clearTimeout(searchId)
    }
  }, [open, query])

  if (!open) {
    return null
  }

  const showPrompt = query.trim().length < minimumQueryLength
  const showEmpty = !showPrompt && status === 'ready' && results.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-20">
      <button
        aria-label="Close search backdrop"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        type="button"
      />
      <section
        aria-label="Search"
        aria-modal="true"
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center gap-3 border-border border-b p-4">
          <input
            aria-autocomplete="list"
            aria-controls="search-dialog-results"
            aria-expanded={results.length > 0}
            aria-label="Search docs"
            className={cn(
              'h-11 flex-1 rounded-md border border-input bg-background px-3 text-base outline-none transition-colors',
              'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30',
            )}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search docs..."
            ref={inputRef}
            role="combobox"
            type="search"
            value={query}
          />
          <button
            aria-label="Close search"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {showPrompt ? <p className="text-muted-foreground text-sm">Type to search...</p> : null}
          {status === 'unavailable' && !showPrompt ? (
            <p className="text-muted-foreground text-sm">Search is unavailable right now.</p>
          ) : null}
          {showEmpty ? <p className="text-muted-foreground text-sm">No results found.</p> : null}
          {results.length > 0 ? (
            <div className="space-y-2" id="search-dialog-results" role="listbox" tabIndex={-1}>
              {results.map((result) => (
                <div aria-selected="false" key={result.id} role="option" tabIndex={-1}>
                  <Link
                    className="block rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted"
                    onClick={() => onOpenChange(false)}
                    to={result.url}
                  >
                    <span className="font-medium text-foreground text-sm">{result.title}</span>
                    <span
                      className="mt-1 block text-muted-foreground text-sm"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: Pagefind produces sanitized excerpts for indexed documents.
                      dangerouslySetInnerHTML={{ __html: result.excerpt }}
                    />
                  </Link>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
