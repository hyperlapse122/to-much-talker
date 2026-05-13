import { createFileRoute, notFound } from '@tanstack/react-router'
import { allDocs } from 'content-collections'

import type { Doc } from 'content-collections'

function getDocBySplat(splat: string | undefined): Doc {
  const doc = allDocs.find((entry) => entry.slug === splat)

  if (doc === undefined) {
    throw notFound()
  }

  return doc
}

export const Route = createFileRoute('/$')({
  loader: ({ params }): Doc => getDocBySplat(params._splat),
})
