# @to-much-talker/docs

Public documentation site for To Much Talker, built as a static SPA.

## Stack

- **Framework**: TanStack Router (SPA mode)
- **Markdown**: unified + Shiki (build-time highlighting)
- **Styling**: Tailwind v4 + shadcn/ui
- **Search**: Pagefind (static search index)

## Development

```bash
yarn workspace @to-much-talker/docs dev
```

- **URL**: http://localhost:4000
- **HMR**: Enabled for components and markdown content.

## Build

```bash
yarn workspace @to-much-talker/docs build
```

- **Output**: `dist/`
- **Search Index**: `dist/pagefind/` (generated via Node API during build).

## Preview

```bash
yarn workspace @to-much-talker/docs preview --port 4000
```

## Test

### Unit & Integration

```bash
yarn workspace @to-much-talker/docs test
```

### End-to-End

```bash
# Install browser (one-time)
yarn workspace @to-much-talker/docs playwright install chromium --with-deps

# Run tests
yarn workspace @to-much-talker/docs test:e2e
```

## Adding a Doc Page

New pages are markdown files under `content/en/`.

### Frontmatter

Every page requires the following frontmatter:

```markdown
---
title: Page Title
description: Brief description for search results
order: 10
---
```

- **Sidebar**: Automatically sorted by the `order` field.
- **Search**: Automatically indexed during the build process.

## Deploy

The site is deployed to GitHub Pages via `.github/workflows/docs-pages.yml`.

- **Base Path**: Configured via `DOCS_BASE_PATH`.
- **SPA Fallback**: `dist/404.html` is generated to handle client-side routing on GitHub Pages.
