# AGENTS — @to-much-talker/config

This package is the **only** place that reads `process.env`. All other packages receive config as parameters.

## Rules

- NO `process.env` access outside this package
- NO file-system reads (entrypoints handle `.env` via `--env-file` flag)
- NO throwing inside `loadConfig` — always return `Result`
- Schema-first: add the zod validation BEFORE using any new env var
- `loadConfigOrExit` is for CLI/bot entrypoints only — it calls `process.exit(1)`
- Every env var must be in `.env.example` at the root

## Adding a New Env Var

1. Add to `src/schema.ts` with type, validation, default, and description comment
2. Add to root `.env.example` with description and required/optional flag
3. Update the env-var table in `apps/docs/content/en/guide/setup.md` (see root AGENTS.md "User Documentation Sync")
4. Run `yarn workspace @to-much-talker/config tsc --noEmit` to verify
