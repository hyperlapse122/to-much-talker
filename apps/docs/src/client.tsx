import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'

import { createRouter } from './router.js'

const router = createRouter()

const rootElement = document.getElementById('root')
if (rootElement !== null && rootElement.innerHTML === '') {
  const root = createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router as never} />
    </StrictMode>,
  )
}
