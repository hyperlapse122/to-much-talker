import { Link as TanStackLink } from '@tanstack/react-router'
import { allDocs } from 'content-collections'
import type { ComponentType, JSX, ReactNode } from 'react'
import { cn } from '@/lib/utils.js'

export interface DocEntry {
  slug: string
  url: string
  title: string
  order: number
}

export interface SidebarSection {
  name: string
  items: DocEntry[]
}

export interface SidebarTree {
  topLevel: DocEntry[]
  sections: SidebarSection[]
}

export interface SidebarLinkProps {
  to: string
  className?: string
  children?: ReactNode
}

export interface SidebarProps {
  docs?: DocEntry[]
  linkComponent?: ComponentType<SidebarLinkProps>
  className?: string
}

function getSection(slug: string): string {
  const separatorIndex = slug.indexOf('/')

  return separatorIndex === -1 ? '' : slug.slice(0, separatorIndex)
}

function byOrderThenTitle(left: DocEntry, right: DocEntry): number {
  const orderDifference = left.order - right.order

  return orderDifference === 0 ? left.title.localeCompare(right.title) : orderDifference
}

export function groupDocsForSidebar(docs: DocEntry[]): SidebarTree {
  const topLevel: DocEntry[] = []
  const sectionItems = new Map<string, DocEntry[]>()

  for (const doc of docs) {
    const section = getSection(doc.slug)

    if (section === '') {
      topLevel.push(doc)
      continue
    }

    const currentItems = sectionItems.get(section)

    if (currentItems === undefined) {
      sectionItems.set(section, [doc])
      continue
    }

    currentItems.push(doc)
  }

  return {
    topLevel: [...topLevel].sort(byOrderThenTitle),
    sections: [...sectionItems.entries()]
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name, items]) => ({ name, items: [...items].sort(byOrderThenTitle) })),
  }
}

function DefaultSidebarLink({ to, className, children }: SidebarLinkProps): JSX.Element {
  return (
    <TanStackLink className={className} to={to}>
      {children}
    </TanStackLink>
  )
}

function SidebarItem({
  doc,
  LinkComponent,
}: {
  doc: DocEntry
  LinkComponent: ComponentType<SidebarLinkProps>
}): JSX.Element {
  return (
    <li>
      <LinkComponent
        className={cn(
          'block rounded-md px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-50',
        )}
        to={doc.url}
      >
        {doc.title}
      </LinkComponent>
    </li>
  )
}

export function Sidebar({
  docs = allDocs,
  linkComponent: LinkComponent = DefaultSidebarLink,
  className,
}: SidebarProps): JSX.Element {
  const tree = groupDocsForSidebar(docs)

  return (
    <nav aria-label="Documentation" className={cn('space-y-6', className)}>
      {tree.topLevel.length > 0 ? (
        <ul className="space-y-1">
          {tree.topLevel.map((doc) => (
            <SidebarItem doc={doc} key={doc.slug} LinkComponent={LinkComponent} />
          ))}
        </ul>
      ) : null}

      {tree.sections.map((section) => (
        <section className="space-y-2" key={section.name}>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {section.name}
          </h2>
          <ul className="space-y-1">
            {section.items.map((doc) => (
              <SidebarItem doc={doc} key={doc.slug} LinkComponent={LinkComponent} />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}
