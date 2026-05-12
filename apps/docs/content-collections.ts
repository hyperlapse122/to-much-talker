import { defineCollection, defineConfig } from '@content-collections/core'
import matter from 'gray-matter'
import { renderMarkdown } from './src/utils/markdown.js'

const docs = defineCollection({
  name: 'docs',
  directory: 'content',
  include: '**/*.md',
  schema: (z) => ({
    title: z.string().min(1),
    description: z.string().min(1),
    order: z.number().int().nonnegative(),
  }),
  transform: async ({ content, _meta, ...rest }) => {
    const { data, content: body } = matter(content)
    const { markup, headings } = await renderMarkdown(body)
    const filePath = _meta.filePath // e.g. "en/guide/setup.md"
    const slug = filePath.replace(/\.md$/, '').replace(/^en\//, '') // -> "guide/setup" or "index"
    const url = slug === 'index' ? '/' : `/${slug}`
    return {
      ...rest,
      ...data,
      slug,
      url,
      rawContent: body,
      markup,
      headings,
    }
  },
})

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({ collections: [docs] })
