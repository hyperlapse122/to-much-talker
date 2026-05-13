import { createLazyFileRoute, Link } from '@tanstack/react-router'
import type { JSX } from 'react'

import { Markdown, type LinkComponentProps } from '@/components/Markdown.js'

import { Route as SplatRoute } from './$.js'

function MarkdownLink({ to, className, children }: LinkComponentProps): JSX.Element {
  return (
    <Link className={className} to={to}>
      {children}
    </Link>
  )
}

function DocPage(): JSX.Element {
  const doc = SplatRoute.useLoaderData()

  return (
    <article>
      <Markdown linkComponent={MarkdownLink} markup={doc.markup} />
    </article>
  )
}

export const Route = createLazyFileRoute('/$')({ component: DocPage })
