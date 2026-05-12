# AGENTS — @to-much-talker/playground

Dev-only TanStack Start application for TTS sandbox and settings inspection.

## Security Rules

- LOCALHOST ONLY by default — binds to 127.0.0.1
- NEVER expose to public internet without explicit `PLAYGROUND_ALLOW_ALL=1`
- Docker mode: `NODE_ENV=docker` + `PLAYGROUND_HOST=0.0.0.0` for container use

## Stack

- TanStack Start v1 + React Router v1
- Tailwind v4 CSS-first
- Shadcn New York style (dark mode default)
- `@tanstack/react-query` for data fetching
- `@tanstack/react-form` + zod for forms

## Build — Vite 8 (mandatory)

The playground is bundled with Vite 8. `tsc` is type-check only (`tsc --noEmit`).

- `build` script: `vite build` (client SPA bundle to `dist/`)
- `typecheck` script: `tsc --noEmit`
- All workspace packages (`@to-much-talker/shared`, `@to-much-talker/i18n`) and
  every npm dependency listed in `package.json` MUST be inlined into the
  produced chunks. Configure `optimizeDeps` / `build.rollupOptions` so nothing
  workspace-related is left as a bare-specifier import at runtime.
- The Docker runtime image serves the static `dist/` via `serve` — there is no
  Node module resolution at runtime. The bundle is the contract.

## Key Files

- `src/app/__root.tsx` — Root layout with nav
- `src/app/index.tsx` — Home page
- `src/app/sandbox.tsx` — TTS sandbox (Task 25)
- `src/app/inspector.tsx` — Settings inspector (Task 26)
- `src/styles/globals.css` — Tailwind v4 tokens

## E2E Tests

- Playwright config: `playwright.config.ts`
- Test files: `tests/e2e/*.spec.ts`
- Run: `yarn workspace @to-much-talker/playground test:e2e`
- Tests run against the production build via `vite preview --port 5173`
- Browser install (one-time): `yarn workspace @to-much-talker/playground exec playwright install chromium`
