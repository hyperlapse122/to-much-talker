import { createFileRoute } from '@tanstack/react-router'
import { allDocs } from 'content-collections'

import type { Doc } from 'content-collections'

function getHomeDoc(): Doc {
  const home = allDocs.find((doc) => doc.slug === 'index')

  if (home === undefined) {
    throw new Error('Home doc not found')
  }

  return home
}

export const Route = createFileRoute('/')({
  loader: (): Doc => getHomeDoc(),
})
