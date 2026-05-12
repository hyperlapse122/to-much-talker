import { defineCollection, defineConfig, type AnyCollection } from '@content-collections/core'
import matter from 'gray-matter'
import { renderMarkdown } from './src/utils/markdown.js'

interface MarkdownHeading {
  depth: number
  text: string
  id: string
}

const docs = defineCollection({
  name: 'docs',
  directory: 'content',
  include: '**/*.md',
  schema: (z) => ({
    title: z.string().min(1),
    description: z.string().min(1),
    order: z.number().int().nonnegative(),
  }),
  transform: async ({
    content,
    _meta,
    ...rest
  }): Promise<{
    title: string
    description: string
    order: number
    slug: string
    url: string
    rawContent: string
    markup: string
    headings: MarkdownHeading[]
  }> => {
    const { content: body } = matter(content)
    const { markup, headings } = (await renderMarkdown(body)) as {
      markup: string
      headings: MarkdownHeading[]
    }
    const filePath = _meta.filePath // e.g. "en/guide/setup.md"
    const slug = filePath.replace(/\.md$/, '').replace(/^en\//, '') // -> "guide/setup" or "index"
    const url = slug === 'index' ? '/' : `/${slug}`
    return {
      ...rest,
      slug,
      url,
      rawContent: body,
      markup,
      headings,
    }
  },
}) as AnyCollection

const config = defineConfig({ collections: [docs] })

// eslint-disable-next-line no-restricted-syntax
export default config
