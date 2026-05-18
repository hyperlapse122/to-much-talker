import rehypeShiki from '@shikijs/rehype'
import type { Element, Root } from 'hast'
import { toString as hastToString } from 'hast-util-to-string'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import type { Plugin } from 'unified'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export interface MarkdownHeading {
  id: string
  text: string
  level: number
}

export interface MarkdownResult {
  markup: string
  headings: MarkdownHeading[]
}

const headingTagPattern = /^h([1-6])$/u
const fencedCodeBlockPattern = /```/u

function isHeadingElement(node: Element): boolean {
  return headingTagPattern.test(node.tagName)
}

function getHeadingLevel(tagName: string): number | undefined {
  const match = headingTagPattern.exec(tagName)
  const level = match?.[1]

  return level === undefined ? undefined : Number.parseInt(level, 10)
}

function getElementId(node: Element): string | undefined {
  const id = node.properties?.id

  return typeof id === 'string' ? id : undefined
}

function createHeadingExtractor(headings: MarkdownHeading[]): Plugin<[], Root> {
  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (!isHeadingElement(node)) {
        return
      }

      const id = getElementId(node)
      const level = getHeadingLevel(node.tagName)

      if (id === undefined || level === undefined) {
        return
      }

      headings.push({ id, text: hastToString(node), level })
    })
  }
}

export async function renderMarkdown(content: string): Promise<MarkdownResult> {
  const headings: MarkdownHeading[] = []

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: { className: ['anchor'] },
    })

  if (fencedCodeBlockPattern.test(content)) {
    processor.use(rehypeShiki, {
      themes: { light: 'github-light', dark: 'tokyo-night' },
      defaultColor: false,
    })
  }

  const file = await processor
    .use(createHeadingExtractor(headings))
    .use(rehypeStringify)
    .process(content)

  return { markup: String(file), headings }
}
