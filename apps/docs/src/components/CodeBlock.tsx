import { Check, Copy, X } from 'lucide-react'
import { type JSX, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils.js'

export interface CodeBlockProps {
  html: string
  raw: string
  language?: string
}

type CopyState = 'idle' | 'copied' | 'failed'

const resetDelayMs = 1500

function getCopyLabel(copyState: CopyState): string {
  if (copyState === 'copied') {
    return 'Copied'
  }

  if (copyState === 'failed') {
    return 'Copy failed'
  }

  return 'Copy code'
}

export function CodeBlock({ html, raw, language }: CodeBlockProps): JSX.Element {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const label = getCopyLabel(copyState)

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== undefined) {
        clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  function queueReset(): void {
    if (resetTimeoutRef.current !== undefined) {
      clearTimeout(resetTimeoutRef.current)
    }

    resetTimeoutRef.current = setTimeout(() => {
      setCopyState('idle')
      resetTimeoutRef.current = undefined
    }, resetDelayMs)
  }

  async function copyCode(): Promise<void> {
    const writeText = navigator.clipboard?.writeText

    if (writeText === undefined) {
      setCopyState('failed')
      queueReset()
      return
    }

    try {
      await writeText.call(navigator.clipboard, raw)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }

    queueReset()
  }

  const Icon = copyState === 'copied' ? Check : copyState === 'failed' ? X : Copy

  return (
    <div className="group relative my-6 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      {language !== undefined && language.length > 0 ? (
        <span className="absolute left-3 top-3 z-10 rounded-md border border-white/10 bg-zinc-950/80 px-2 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-wide text-zinc-300 backdrop-blur">
          {language}
        </span>
      ) : null}
      <button
        aria-label={label}
        className={cn(
          'absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-zinc-950/80 text-zinc-200 shadow-sm backdrop-blur transition-colors',
          'hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          copyState === 'copied' && 'text-emerald-300 hover:text-emerald-200',
          copyState === 'failed' && 'text-red-300 hover:text-red-200',
        )}
        onClick={() => {
          void copyCode()
        }}
        type="button"
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </button>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki HTML is rendered at build time before this component receives it. */}
      <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
