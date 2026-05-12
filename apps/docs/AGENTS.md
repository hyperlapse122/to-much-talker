# AGENTS — @to-much-talker/docs

Documentation site for To Much Talker.

## Stack

- React + React Router v7
- Vite 8 + Tailwind v4
- react-markdown + remark-gfm

## Build — Vite 8 (mandatory)

The docs site is bundled with Vite 8. `tsc` is type-check only (`tsc --noEmit`).

- `build` script: `vite build` (static SPA bundle to `dist/`)
- `typecheck` script: `tsc --noEmit`
- All workspace packages and every npm dependency listed in `package.json`
  MUST be inlined into the produced chunks. Nothing should be left as a
  bare-specifier import at runtime.
- The Docker runtime image serves the static `dist/` via `serve` — there is no
  Node module resolution at runtime. The bundle is the contract.

## Rules

- All content in content/ uses frontmatter (title, description, order)
- New pages require adding a route in App.tsx
- Build must pass before committing content changes

## E2E Tests

- Playwright config: `playwright.config.ts`
- Test files: `tests/e2e/*.spec.ts`
- Run: `yarn workspace @to-much-talker/docs test:e2e`
- Tests run against the production build via `vite preview --port 4000`
- Browser install (one-time): `yarn workspace @to-much-talker/docs exec playwright install chromium`
