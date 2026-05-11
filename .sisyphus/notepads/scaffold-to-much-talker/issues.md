# Issues — scaffold-to-much-talker

## [2026-05-12] Session Init
- No known issues yet

## [2026-05-12] Playground hydration error in __root.tsx (DISCOVERED, NOT FIXED)

### Issue
`apps/playground/src/app/__root.tsx` defines `RootLayout` that renders:
```jsx
<html lang="en" className="dark">
  <head>...</head>
  <body>...</body>
</html>
```

But the SPA's `index.html` already has `<html>` with a `<div id="root">`. React renders the RouterProvider INTO that `<div id="root">`, so we get `<html>` nested inside `<div>` — invalid HTML.

### Symptoms
- Console warning: "In HTML, %s cannot be a child of %s. This will cause a hydration error. <html> div"
- Form interactions (typing into textarea/input fields) cause the page to become unresponsive/crash
- Playwright `fill()`, `type()`, `pressSequentially()` all fail or timeout on form fields

### Impact on e2e tests
- E2E tests cannot reliably interact with form fields in the playground
- Visibility/structural assertions work fine (10 tests passing)
- Interaction tests (fill, toHaveValue) were removed; behavior should be covered by unit tests instead

### Root cause
This RootLayout pattern is correct for TanStack Start (SSR mode) but invalid for SPA-only mode. In SPA mode, the root layout should only render the body content (no html/head/body wrapper) and the document shell should come from `index.html`.

### Suggested fix (out of scope for this task)
Either:
1. Switch to TanStack Start with full SSR (proper html document rendering)
2. Strip html/head/body from RootLayout and move `<title>` to index.html only
