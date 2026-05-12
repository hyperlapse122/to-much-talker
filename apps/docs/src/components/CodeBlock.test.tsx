import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodeBlock } from './CodeBlock.js'

const shikiHtml = '<pre class="shiki"><code><span>const ok = true</span></code></pre>'
const mountedRoots: Root[] = []

function setClipboard(clipboard: Pick<Clipboard, 'writeText'> | undefined): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  })
}

function renderCodeBlock(
  props: { html?: string; raw?: string; language?: string } = {},
): HTMLElement {
  const container = document.createElement('div')
  const root = createRoot(container)
  mountedRoots.push(root)
  const codeBlockProps = {
    html: props.html ?? shikiHtml,
    raw: props.raw ?? 'const ok = true',
    ...(props.language === undefined ? {} : { language: props.language }),
  }

  act(() => {
    root.render(<CodeBlock {...codeBlockProps} />)
  })

  return container
}

function getCopyButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button')

  if (button === null) {
    throw new Error('Expected copy button to exist')
  }

  return button
}

describe('CodeBlock', () => {
  afterEach(() => {
    for (const root of mountedRoots) {
      act(() => {
        root.unmount()
      })
    }
    mountedRoots.length = 0
    vi.restoreAllMocks()
    setClipboard(undefined)
  })

  it('renders provided Shiki HTML without parsing markdown', () => {
    const container = renderCodeBlock({ language: 'ts' })
    const code = container.querySelector('pre code span')
    const pre = container.querySelector('pre')

    expect(code).toHaveTextContent('const ok = true')
    expect(container).toHaveTextContent('ts')
    expect(pre).toHaveClass('shiki')
  })

  it('renders an accessible copy button', () => {
    const container = renderCodeBlock()

    expect(getCopyButton(container)).toHaveAttribute('aria-label', 'Copy code')
  })

  it('copies raw code to the clipboard', async () => {
    const writeText = vi.fn<Clipboard['writeText']>().mockResolvedValue(undefined)
    setClipboard({ writeText })

    const container = renderCodeBlock()

    await act(async () => {
      getCopyButton(container).click()
    })

    expect(writeText).toHaveBeenCalledWith('const ok = true')
  })

  it('shows copied state after a successful copy', async () => {
    const writeText = vi.fn<Clipboard['writeText']>().mockResolvedValue(undefined)
    setClipboard({ writeText })

    const container = renderCodeBlock()

    await act(async () => {
      getCopyButton(container).click()
    })

    expect(getCopyButton(container)).toHaveAttribute('aria-label', 'Copied')
  })

  it('shows failed state when clipboard is unavailable', async () => {
    setClipboard(undefined)

    const container = renderCodeBlock()

    await act(async () => {
      getCopyButton(container).click()
    })

    expect(getCopyButton(container)).toHaveAttribute('aria-label', 'Copy failed')
  })
})
