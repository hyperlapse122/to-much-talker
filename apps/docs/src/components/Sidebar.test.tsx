import type { JSX } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { type DocEntry, groupDocsForSidebar, Sidebar, type SidebarLinkProps } from './Sidebar.js'

const mountedRoots: Root[] = []

function PlainLink({ to, className, children }: SidebarLinkProps): JSX.Element {
  return (
    <a className={className} data-router-link="true" href={to}>
      {children}
    </a>
  )
}

function renderSidebar(docs: DocEntry[]): HTMLElement {
  const container = document.createElement('div')
  const root = createRoot(container)
  mountedRoots.push(root)

  act(() => {
    root.render(<Sidebar docs={docs} linkComponent={PlainLink} />)
  })

  return container
}

function queryRequired<T extends Element>(container: ParentNode, selector: string): T {
  const element = container.querySelector<T>(selector)

  if (element === null) {
    throw new Error(`Expected selector to match: ${selector}`)
  }

  return element
}

function getLinkTexts(container: ParentNode): string[] {
  return [...container.querySelectorAll('a')].map((link) => link.textContent ?? '')
}

describe('groupDocsForSidebar', () => {
  it('places docs without a slug folder into top-level entries sorted by order', () => {
    const tree = groupDocsForSidebar([
      { slug: 'guide/setup', url: '/guide/setup', title: 'Setup Guide', order: 1 },
      { slug: 'faq', url: '/faq', title: 'FAQ', order: 2 },
      { slug: 'index', url: '/', title: 'To Much Talker', order: 0 },
    ])

    expect(tree.topLevel.map((doc) => doc.slug)).toEqual(['index', 'faq'])
    expect(tree.sections.map((section) => section.name)).toEqual(['guide'])
  })

  it('groups docs by the first slug folder and sorts sections by name', () => {
    const tree = groupDocsForSidebar([
      { slug: 'reference/models', url: '/reference/models', title: 'Models', order: 1 },
      { slug: 'guide/commands', url: '/guide/commands', title: 'Commands Reference', order: 2 },
      { slug: 'guide/setup', url: '/guide/setup', title: 'Setup Guide', order: 1 },
    ])

    expect(tree.sections).toEqual([
      {
        name: 'guide',
        items: [
          { slug: 'guide/setup', url: '/guide/setup', title: 'Setup Guide', order: 1 },
          { slug: 'guide/commands', url: '/guide/commands', title: 'Commands Reference', order: 2 },
        ],
      },
      {
        name: 'reference',
        items: [{ slug: 'reference/models', url: '/reference/models', title: 'Models', order: 1 }],
      },
    ])
  })
})

describe('Sidebar', () => {
  afterEach(() => {
    for (const root of mountedRoots) {
      act(() => {
        root.unmount()
      })
    }
    mountedRoots.length = 0
  })

  it('renders an accessible documentation navigation landmark', () => {
    const container = renderSidebar([
      { slug: 'index', url: '/', title: 'To Much Talker', order: 0 },
    ])

    const nav = queryRequired<HTMLElement>(container, 'nav')

    expect(nav).toHaveAttribute('aria-label', 'Documentation')
  })

  it('renders titles and hrefs with the injected link component', () => {
    const container = renderSidebar([
      { slug: 'index', url: '/', title: 'To Much Talker', order: 0 },
      { slug: 'guide/setup', url: '/guide/setup', title: 'Setup Guide', order: 1 },
    ])

    const links = [...container.querySelectorAll<HTMLAnchorElement>('a')]

    expect(getLinkTexts(container)).toEqual(['To Much Talker', 'Setup Guide'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/guide/setup'])
    expect(links.every((link) => link.getAttribute('data-router-link') === 'true')).toBe(true)
  })

  it('renders section headings exactly as their slug folder names', () => {
    const container = renderSidebar([
      { slug: 'guide/setup', url: '/guide/setup', title: 'Setup Guide', order: 1 },
    ])

    const heading = queryRequired<HTMLHeadingElement>(container, 'h2')

    expect(heading).toHaveTextContent('guide')
  })
})
