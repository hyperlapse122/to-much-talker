import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createIndex } from 'pagefind'

interface DocRecord {
  slug: string
  url: string
  title: string
  description: string
  markup: string
}

async function loadDocs(): Promise<DocRecord[]> {
  const generatedPath = resolve(process.cwd(), '.content-collections/generated/index.js')
  const generated = (await import(pathToFileURL(generatedPath).href)) as { allDocs: DocRecord[] }

  return generated.allDocs
}

function stripHtml(markup: string): string {
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatErrors(context: string, errors: string[]): Error {
  return new Error(`${context}: ${errors.join('; ')}`)
}

async function main(): Promise<void> {
  const outDir = resolve(process.cwd(), 'dist/pagefind')
  await rm(outDir, { recursive: true, force: true })

  const { errors: createErrors, index } = await createIndex({})
  if (createErrors.length > 0) {
    throw formatErrors('Failed to create Pagefind index', createErrors)
  }

  if (index === undefined) {
    throw new Error('Failed to create Pagefind index: Pagefind did not return an index')
  }

  const docs = await loadDocs()
  for (const doc of docs) {
    const { errors: addErrors } = await index.addCustomRecord({
      url: doc.url,
      content: stripHtml(doc.markup),
      language: 'en',
      meta: {
        title: doc.title,
        description: doc.description,
      },
    })

    if (addErrors.length > 0) {
      throw formatErrors(`Failed to add Pagefind record for ${doc.slug}`, addErrors)
    }
  }

  const { errors: writeErrors } = await index.writeFiles({ outputPath: outDir })
  if (writeErrors.length > 0) {
    throw formatErrors('Failed to write Pagefind files', writeErrors)
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
