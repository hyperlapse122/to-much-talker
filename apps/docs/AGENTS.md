# AGENTS — @to-much-talker/docs

Documentation site for To Much Talker.

## Stack

- React + React Router v7
- Vite + Tailwind v4
- react-markdown + remark-gfm

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
