import type { DOMNode, HTMLReactParserOptions } from 'html-react-parser'
import parse, { domToReact, Element } from 'html-react-parser'
import type { ComponentType, JSX, ReactNode } from 'react'
import { cn } from '@/lib/utils.js'
import { CodeBlock } from './CodeBlock.js'

export interface LinkComponentProps {
  to: string
  className?: string
  children?: ReactNode
}

export interface MarkdownProps {
  markup: string
  linkComponent: ComponentType<LinkComponentProps>
  className?: string
}

const languageClassPattern = /(?:^|\s)language-([^\s]+)/u

function getAttribute(node: Element, name: string): string | undefined {
  return node.attribs[name]
}

function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

function isExternalHref(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://')
}

function isElement(node: DOMNode): node is Element {
  return node instanceof Element
}

function getFirstElementChild(node: Element, tagName: string): Element | undefined {
  return getDomChildren(node).find(
    (child): child is Element => isElement(child) && child.name === tagName,
  )
}

function getDomChildren(node: Element): DOMNode[] {
  return node.children as DOMNode[]
}

function getLanguage(code: Element): string | undefined {
  const className = getAttribute(code, 'class')
  const match = className === undefined ? null : languageClassPattern.exec(className)

  return match?.[1]
}

function getRawText(node: DOMNode): string {
  if (node.type === 'text') {
    return node.data
  }

  if ('children' in node) {
    return getDomChildren(node)
      .map((child) => getRawText(child))
      .join('')
  }

  return ''
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;')
}

function serializeAttributes(node: Element): string {
  return Object.entries(node.attribs)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')
}

function serializeNode(node: DOMNode): string {
  if (node.type === 'text') {
    return escapeText(node.data)
  }

  if (node.type === 'comment') {
    return `<!--${node.data}-->`
  }

  if (!isElement(node)) {
    return ''
  }

  const children = getDomChildren(node)
    .map((child) => serializeNode(child))
    .join('')

  return `<${node.name}${serializeAttributes(node)}>${children}</${node.name}>`
}

function createOptions(Link: ComponentType<LinkComponentProps>): HTMLReactParserOptions {
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!isElement(node)) {
        return undefined
      }

      if (node.name === 'a') {
        const href = getAttribute(node, 'href')
        const className = getAttribute(node, 'class')
        const children = domToReact(getDomChildren(node), options)

        if (href !== undefined && isInternalHref(href)) {
          const linkProps = className === undefined ? { to: href } : { className, to: href }

          return <Link {...linkProps}>{children}</Link>
        }

        if (href !== undefined && isExternalHref(href)) {
          return (
            <a className={className} href={href} rel="noopener noreferrer" target="_blank">
              {children}
            </a>
          )
        }

        return undefined
      }

      if (node.name === 'img') {
        return (
          <img
            alt={getAttribute(node, 'alt') ?? ''}
            loading="lazy"
            src={getAttribute(node, 'src')}
          />
        )
      }

      if (node.name === 'pre') {
        const code = getFirstElementChild(node, 'code')

        if (code === undefined) {
          return undefined
        }

        const language = getLanguage(code)
        const raw = getRawText(code)
        const html = serializeNode(node)

        const codeBlockProps = language === undefined ? { html, raw } : { html, language, raw }

        return <CodeBlock {...codeBlockProps} />
      }

      return undefined
    },
  }

  return options
}

export function Markdown({ markup, linkComponent: Link, className }: MarkdownProps): JSX.Element {
  return (
    <div className={cn('prose prose-invert max-w-none', className)}>
      {parse(markup, createOptions(Link))}
    </div>
  )
}
