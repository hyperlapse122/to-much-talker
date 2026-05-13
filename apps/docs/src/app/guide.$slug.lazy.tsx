import { createLazyFileRoute, Link } from '@tanstack/react-router'
import type { JSX } from 'react'

import { Markdown, type LinkComponentProps } from '@/components/Markdown.js'

import { Route as GuideRoute } from './guide.$slug.js'

function MarkdownLink({ to, className, children }: LinkComponentProps): JSX.Element {
  return (
    <Link className={className} to={to}>
      {children}
    </Link>
  )
}

function GuidePage(): JSX.Element {
  const guide = GuideRoute.useLoaderData()

  return (
    <article>
      <Markdown linkComponent={MarkdownLink} markup={guide.markup} />
    </article>
  )
}

export const Route = createLazyFileRoute('/guide/$slug')({ component: GuidePage })
