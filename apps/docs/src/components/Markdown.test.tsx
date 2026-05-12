import type { ComponentProps, JSX } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { type LinkComponentProps, Markdown } from './Markdown.js'

const mountedRoots: Root[] = []

function PlainLink({ to, className, children }: LinkComponentProps): JSX.Element {
  return (
    <a className={className} data-router-link="true" href={to}>
      {children}
    </a>
  )
}

function renderMarkdown(
  props: Omit<ComponentProps<typeof Markdown>, 'linkComponent'>,
): HTMLElement {
  const container = document.createElement('div')
  const root = createRoot(container)
  mountedRoots.push(root)

  act(() => {
    root.render(<Markdown {...props} linkComponent={PlainLink} />)
  })

  return container
}

function getWrapper(container: HTMLElement): HTMLElement {
  const wrapper = container.firstElementChild

  if (!(wrapper instanceof HTMLElement)) {
    throw new Error('Expected Markdown wrapper to render')
  }

  return wrapper
}

function queryRequired<T extends Element>(container: ParentNode, selector: string): T {
  const element = container.querySelector<T>(selector)

  if (element === null) {
    throw new Error(`Expected selector to match: ${selector}`)
  }

  return element
}

describe('Markdown', () => {
  afterEach(() => {
    for (const root of mountedRoots) {
      act(() => {
        root.unmount()
      })
    }
    mountedRoots.length = 0
  })

  it('renders already-rendered HTML markup inside the prose wrapper', () => {
    const container = renderMarkdown({
      markup: '<p>Hello <strong>docs</strong></p><ul><li>Fast</li></ul>',
      className: 'custom-docs',
    })
    const wrapper = getWrapper(container)

    expect(wrapper).toHaveClass('prose', 'prose-invert', 'max-w-none', 'custom-docs')
    expect(wrapper.querySelector('p')).toHaveTextContent('Hello docs')
    expect(queryRequired(wrapper, 'strong').textContent).toBe('docs')
    expect(queryRequired(wrapper, 'li').textContent).toBe('Fast')
  })

  it('replaces root-relative internal links with the injected link component', () => {
    const container = renderMarkdown({
      markup: '<p><a class="anchor-link" href="/guide/start">Start</a></p>',
    })

    const link = queryRequired<HTMLAnchorElement>(container, 'a')

    expect(link).toHaveAttribute('data-router-link', 'true')
    expect(link).toHaveAttribute('href', '/guide/start')
    expect(link).toHaveClass('anchor-link')
  })

  it('preserves external links as secure anchors', () => {
    const container = renderMarkdown({
      markup: '<p><a class="external" href="https://example.com/docs">External</a></p>',
    })

    const link = queryRequired<HTMLAnchorElement>(container, 'a')

    expect(link).not.toHaveAttribute('data-router-link')
    expect(link).toHaveAttribute('href', 'https://example.com/docs')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveClass('external')
  })

  it('lazy-loads images while preserving source and alt text', () => {
    const container = renderMarkdown({
      markup: '<p><img src="/images/bot.png" alt="Talker bot"></p>',
    })
    const image = queryRequired<HTMLImageElement>(container, 'img')

    expect(image).toHaveAttribute('src', '/images/bot.png')
    expect(image).toHaveAttribute('alt', 'Talker bot')
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it('replaces Shiki pre code blocks with CodeBlock', () => {
    const container = renderMarkdown({
      markup:
        '<pre class="shiki" style="background:#111"><code class="language-ts"><span>const voice = "Gemini"</span></code></pre>',
    })

    const codeBlock = queryRequired<HTMLElement>(container, '.group')
    const codeRegion = queryRequired<HTMLElement>(codeBlock, '.overflow-x-auto')

    expect(codeBlock).toHaveTextContent('ts')
    expect(codeBlock).toContainElement(codeRegion)
    expect(codeBlock).toHaveTextContent('const voice = "Gemini"')
    expect(queryRequired(codeBlock, 'button')).toHaveAttribute('aria-label', 'Copy code')
  })

  it('preserves heading ids and generated heading anchors', () => {
    const container = renderMarkdown({
      markup:
        '<h2 id="linked-heading"><a class="anchor" href="#linked-heading">Linked Heading</a></h2>',
    })

    const heading = queryRequired<HTMLHeadingElement>(container, 'h2')
    const anchor = queryRequired<HTMLAnchorElement>(heading, 'a')

    expect(heading).toHaveAttribute('id', 'linked-heading')
    expect(anchor).toHaveAttribute('href', '#linked-heading')
    expect(anchor).toHaveClass('anchor')
    expect(anchor).not.toHaveAttribute('data-router-link')
  })
})
