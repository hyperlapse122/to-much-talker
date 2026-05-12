import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown.js'

describe('renderMarkdown', () => {
  it('renders basic markdown to HTML markup', async () => {
    const result = await renderMarkdown('Hello **docs**')

    expect(result.markup).toContain('<p>Hello <strong>docs</strong></p>')
    expect(result.headings).toEqual([])
  })

  it('extracts heading ids, text, and levels after slugging', async () => {
    const result = await renderMarkdown('# Start Here\n\n### Deeper Section')

    expect(result.headings).toEqual([
      { id: 'start-here', text: 'Start Here', level: 1 },
      { id: 'deeper-section', text: 'Deeper Section', level: 3 },
    ])
  })

  it('renders GFM tables', async () => {
    const result = await renderMarkdown('| Name | Value |\n| --- | --- |\n| Bot | TTS |')

    expect(result.markup).toContain('<table>')
    expect(result.markup).toContain('<th>Name</th>')
    expect(result.markup).toContain('<td>TTS</td>')
  })

  it('wraps headings with anchor links', async () => {
    const result = await renderMarkdown('## Linked Heading')

    expect(result.markup).toContain('<h2 id="linked-heading">')
    expect(result.markup).toContain('<a class="anchor" href="#linked-heading">Linked Heading</a>')
  })

  it('highlights fenced code with Shiki', async () => {
    const result = await renderMarkdown('```ts\nconst voice = "Gemini"\n```')

    expect(result.markup).toContain('shiki')
    expect(result.markup).toMatch(/style="(?:color:|--shiki)/)
  })

  it('preserves raw HTML', async () => {
    const result = await renderMarkdown('<aside data-kind="note"><strong>Note</strong></aside>')

    expect(result.markup).toContain('<aside data-kind="note"><strong>Note</strong></aside>')
  })
})
