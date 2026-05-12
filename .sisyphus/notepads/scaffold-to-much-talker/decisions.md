# Decisions — scaffold-to-much-talker

## [2026-05-12] Session Init

### Confirmed from Plan Interview
- ESLint flat config (`eslint.config.js`) — no `.eslintrc`
- No default exports — named exports only
- No `as any` — use type assertions with explicit types
- No `console.log` outside CLI entry
- No emojis in identifiers/strings
- Prettier: no semis, single quotes, trailing comma all, LF
- Conventional Commits enforced via commitlint + lefthook
- MIT License, year 2026
- `.changeset/config.json`: `access: "public"`, `baseBranch: "main"`
