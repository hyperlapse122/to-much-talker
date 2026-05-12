import { createFileRoute, notFound } from '@tanstack/react-router'
import { allDocs } from 'content-collections'

import type { Doc } from 'content-collections'

function getGuideDoc(slug: string): Doc {
  const guide = allDocs.find((doc) => doc.slug === `guide/${slug}`)

  if (guide === undefined) {
    throw notFound()
  }

  return guide
}

export const Route = createFileRoute('/guide/$slug')({
  loader: ({ params }): Doc => getGuideDoc(params.slug),
})
