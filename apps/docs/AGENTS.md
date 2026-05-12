# AGENTS — @to-much-talker/docs

Public documentation site for To Much Talker, built as a static SPA with TanStack Router and Markdown.

## Stack

- **Framework**: TanStack Router (file-based routing, lazy chunks)
- **React**: React 19
- **Styling**: Tailwind v4 + shadcn/ui (New York style, dark mode default) + `@tailwindcss/typography`
- **Markdown**: `content-collections` + `unified` + `remark` + `rehype`
- **Syntax Highlighting**: `@shikijs/rehype` (BUILD TIME ONLY)
- **Search**: Pagefind (Node API driven)
- **Language**: TypeScript 5.x (strictest)
- **Build**: Vite 8

## Markdown Pipeline

- **Source**: `content/en/**/*.md`
- **Processing**: `content-collections.ts` validates frontmatter (`title`, `description`, `order`).
- **Transformation**: `src/utils/markdown.ts` uses `unified` to convert MD to HTML.
- **Rendering**: `src/components/Markdown.tsx` uses `html-react-parser` to render the processed HTML.
- **Shiki**: Syntax highlighting is applied during the build-time transformation. **MUST NOT** import Shiki at runtime in `src/components/` or `src/app/`.

## Search Implementation

- **Pagefind**: Uses the Node API in `scripts/build-search-index.ts`.
- **Indexing**: Records are generated from `content-collections` data during the build process.
- **Runtime**: `src/components/SearchDialog.tsx` interacts with the generated Pagefind index.

## Build & Deployment

- **Build Script**: `yarn workspace @to-much-talker/docs build`
- **Output**: Static files in `dist/`.
- **GitHub Pages**: Deployed via `.github/workflows/docs-pages.yml`.
- **Base Path**: Uses `DOCS_BASE_PATH` env var. TanStack Router `basepath` is derived from `import.meta.env.BASE_URL`.
- **SPA Fallback**: `dist/404.html` is a copy of `index.html` for GitHub Pages routing.

## Key Rules

- **Routing**: Use TanStack Router exclusively for routing.
- **Markdown**: Use the `unified` pipeline exclusively for markdown rendering and syntax highlighting.
- **NO Runtime Shiki**: Keep the bundle slim by processing highlighting at build time.
- **Generated Files**:
    - `src/routeTree.gen.ts` **MUST** be committed.
    - `.content-collections/` **MUST** be ignored.
- **E2E Tests**:
    - Port: 14000
    - Command: `yarn workspace @to-much-talker/docs test:e2e`
    - Report: `apps/docs/playwright-report/`

## Development

```bash
yarn workspace @to-much-talker/docs dev
# Opens at http://localhost:4000
```
