import { createLazyFileRoute } from '@tanstack/react-router'

import { NotFoundPage } from '@/components/NotFoundPage.js'

export const Route = createLazyFileRoute('/$')({ component: NotFoundPage })
