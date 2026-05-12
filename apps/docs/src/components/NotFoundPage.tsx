import { Link } from '@tanstack/react-router'
import type { JSX } from 'react'

export function NotFoundPage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-4 px-6 py-16 text-foreground">
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-base text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        className="text-base font-medium text-primary underline-offset-4 hover:underline"
        to="/"
      >
        Go home
      </Link>
    </main>
  )
}
