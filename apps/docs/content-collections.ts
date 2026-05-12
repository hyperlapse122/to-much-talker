import { defineCollection, defineConfig } from '@content-collections/core'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import matter from 'gray-matter'
import { renderMarkdown } from './src/utils/markdown.js'

interface MarkdownHeading {
  level: number
  text: string
  id: string
}

interface DocsCollection {
  name: 'docs'
  directory: 'content'
  include: '**/*.md'
  parser: 'frontmatter'
  typeName: string
  schema: StandardSchemaV1
}

const docs: DocsCollection = defineCollection({
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
})

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({ collections: [docs] })
