import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/history'

import { routeTree } from './routeTree.gen.js'

export function createRouter() {
  const rawBase = import.meta.env.BASE_URL
  const basepath = rawBase.endsWith('/') && rawBase.length > 1 ? rawBase.slice(0, -1) : rawBase

  return createTanStackRouter<never, 'never', false, RouterHistory, Record<string, unknown>>({
    routeTree: routeTree as never,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    context: {} as never,
    basepath: basepath === '/' ? '' : basepath,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
