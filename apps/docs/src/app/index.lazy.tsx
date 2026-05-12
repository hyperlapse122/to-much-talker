import { createLazyFileRoute, Link } from '@tanstack/react-router'
import type { JSX } from 'react'

import { Markdown, type LinkComponentProps } from '@/components/Markdown.js'

import { Route as IndexRoute } from './index.js'

function MarkdownLink({ to, className, children }: LinkComponentProps): JSX.Element {
  return (
    <Link className={className} to={to}>
      {children}
    </Link>
  )
}

function HomePage(): JSX.Element {
  const home = IndexRoute.useLoaderData()

  return (
    <article>
      <Markdown linkComponent={MarkdownLink} markup={home.markup} />
    </article>
  )
}

export const Route = createLazyFileRoute('/')({ component: HomePage })
