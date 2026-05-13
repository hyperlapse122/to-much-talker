import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchDialog } from './SearchDialog.js'

const mountedRoots: Root[] = []
const mountedContainers: HTMLElement[] = []

function renderSearchDialog({
  open,
  onOpenChange = vi.fn(),
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
}): { container: HTMLElement; onOpenChange: (open: boolean) => void } {
  const container = document.createElement('div')
  document.body.append(container)
  mountedContainers.push(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  act(() => {
    root.render(<SearchDialog onOpenChange={onOpenChange} open={open} />)
  })

  return { container, onOpenChange }
}

function queryRequired<T extends Element>(container: ParentNode, selector: string): T {
  const element = container.querySelector<T>(selector)

  if (element === null) {
    throw new Error(`Expected selector to match: ${selector}`)
  }

  return element
}

describe('SearchDialog', () => {
  afterEach(() => {
    for (const root of mountedRoots) {
      act(() => {
        root.unmount()
      })
    }
    mountedRoots.length = 0

    for (const container of mountedContainers) {
      container.remove()
    }
    mountedContainers.length = 0
  })

  it('renders null when closed', () => {
    const { container } = renderSearchDialog({ open: false })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders an accessible dialog with search input and close button when open', () => {
    const { container } = renderSearchDialog({ open: true })

    const dialog = queryRequired<HTMLElement>(container, '[role="dialog"]')
    const input = queryRequired<HTMLInputElement>(container, 'input[role="combobox"]')
    const closeButton = queryRequired<HTMLButtonElement>(
      container,
      'button[aria-label="Close search"]',
    )

    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Search')
    expect(input).toHaveAttribute('aria-label', 'Search docs')
    expect(closeButton).toHaveAttribute('aria-label', 'Close search')
  })

  it('closes when the close button is clicked', () => {
    const { container, onOpenChange } = renderSearchDialog({ open: true })
    const closeButton = queryRequired<HTMLButtonElement>(
      container,
      'button[aria-label="Close search"]',
    )

    act(() => {
      closeButton.click()
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes when Escape is pressed', () => {
    const { onOpenChange } = renderSearchDialog({ open: true })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps tab focus inside the dialog', () => {
    const { container } = renderSearchDialog({ open: true })
    const input = queryRequired<HTMLInputElement>(container, 'input[role="combobox"]')
    const closeButton = queryRequired<HTMLButtonElement>(
      container,
      'button[aria-label="Close search"]',
    )

    act(() => {
      closeButton.focus()
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }))
    })

    expect(input).toHaveFocus()

    act(() => {
      input.focus()
      window.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true }),
      )
    })

    expect(closeButton).toHaveFocus()
  })

  it('closes when the backdrop is clicked', () => {
    const { container, onOpenChange } = renderSearchDialog({ open: true })
    const backdrop = queryRequired<HTMLButtonElement>(
      container,
      'button[aria-label="Close search backdrop"]',
    )

    act(() => {
      backdrop.click()
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows an empty prompt for queries shorter than two characters', () => {
    const { container } = renderSearchDialog({ open: true })
    const input = queryRequired<HTMLInputElement>(container, 'input[role="combobox"]')

    act(() => {
      input.value = 'a'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(container).toHaveTextContent('Type to search...')
  })
})
