# AGENTS

Project-level agent instructions for the **To Much Talker** monorepo.
These rules OVERRIDE the user-level AGENTS.md where they conflict.

## Project Overview

To Much Talker is a Discord TTS (text-to-speech) bot that synthesizes voice via OpenRouter TTS models
(Gemini Flash TTS, GPT-4o Mini TTS). It runs in cluster+shard mode, ships as Docker images, and
includes a dev-only TanStack Start playground and a public SSR markdown docs site.

## Architecture Map

```
to-much-talker/
├── apps/
│   ├── server/        — discord.js v14 bot + CLI (cluster manager + worker auto-detect)
│   ├── playground/    — dev-only TanStack Start + Shadcn/Tailwind v4 sandbox
│   └── docs/          — SSR markdown docs site (GFM + Shiki + Pagefind search)
└── packages/
    ├── shared/        — types, errors, branded IDs, Result<T,E> helpers
    ├── config/        — zod-validated env loader
    ├── i18n/          — Paraglide JS messages (en/ko/ja) + Discord locale mapping
    ├── crypto/        — AES-256-GCM + master key versioning
    ├── db/            — drizzle-orm dual-dialect (SQLite / Postgres)
    ├── ai/            — OpenRouter client (TTS via openai SDK + chat via TanStack AI)
    ├── settings-core/ — settings resolver (clamps), LRU cache, IpcTransport interface
    └── test-utils/    — mocked Discord interaction builders, ephemeral DB helpers
```

## Tech Stack with Rationale

| Layer           | Tech                               | Why                                         |
| --------------- | ---------------------------------- | ------------------------------------------- |
| Package manager | Yarn 4 Berry (node-modules linker) | Already established; workspaces support     |
| Monorepo        | Turborepo                          | Pipeline caching + parallel task execution  |
| Runtime         | Node.js 24 (ESM-only)              | Latest LTS; native ESM; no transpile step   |
| Language        | TypeScript 5.x (strictest)         | Type safety across all packages             |
| Discord         | discord.js v14 + @discordjs/voice  | Standard; active maintenance                |
| Sharding        | discord-hybrid-sharding            | Multi-process clustering with built-in IPC  |
| Database        | Drizzle ORM (SQLite + Postgres)    | Dual-dialect discriminated union; type-safe |
| AI/TTS          | openai SDK → OpenRouter API        | OpenRouter TTS is OpenAI-compatible         |
| Chat AI         | TanStack AI                        | Playground chat features only               |
| Secrets         | AES-256-GCM (MASTER_ENC_KEY)       | Per-guild BYOK with key versioning          |
| i18n            | Paraglide JS                       | Full SSR; compile-time message keys         |
| Logger          | pino                               | Structured JSON, low overhead               |
| Tests           | Vitest + Playwright                | Unit/integration + e2e                      |
| Docker          | node:24-slim, 3 images             | Minimal footprint; GHCR distribution        |
| CI              | GitHub Actions + Changesets        | Automated release + Docker publish          |

## Monorepo Commands

```bash
yarn install                          # Install all dependencies
yarn turbo run build                  # Build all packages
yarn turbo run lint                   # Lint all packages
yarn turbo run typecheck              # Type-check all packages
yarn turbo run test                   # Run all tests
yarn turbo run dev                    # Start all dev servers (no cache)
yarn workspace @to-much-talker/server dev  # Start specific workspace
changeset                             # Create a changeset
changeset version                     # Bump versions
changeset publish                     # Publish packages
```

## Coding Conventions

### Non-Negotiable Rules

1. **NO default exports** — always use named exports (`export const foo = ...`, `export function bar() {}`)
   - Exception: `eslint.config.js` (ESLint flat config requires default export)
   - Exception: `commitlint.config.js` (commitlint requires default export)
2. **NO `as any`** — use explicit types; `unknown` + type guard if needed
3. **NO `@ts-ignore`** — use `@ts-expect-error` with a description (min 10 chars)
4. **NO `console.log`** outside `apps/server/src/cli/**` — use pino logger
5. **NO Python files** — TypeScript for all code; Bash for OS-level scripts only
6. **NO emoji** in identifiers, strings, or code comments
7. **NO Sentry, Prometheus, Redis** — out of scope
8. **NO multi-arch Docker** — linux/amd64 only

### TypeScript

- `module: "NodeNext"`, `moduleResolution: "NodeNext"` — always use `.js` extensions in imports
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `noUncheckedIndexedAccess: true` — array/map access always returns `T | undefined`
- `exactOptionalPropertyTypes: true` — `{ a?: string }` means `{ a: string | undefined }` not `{ a?: string }`

### File & Export Conventions

- One concept per file; filename = primary export name (camelCase for functions, PascalCase for classes/types)
- Barrel exports (`index.ts`) are acceptable per package
- Always declare return types on public functions
- Use `satisfies` over `as` for type assertions where possible

### Error Handling

- Use `Result<T, E>` from `@to-much-talker/shared` — no throwing across module boundaries
- Discord command handlers: always `.reply()` or `.editReply()` — never let interaction time out
- DB errors: wrap in `Result.err(new DbError(...))` — never expose raw SQL errors to Discord

## Discord-Specific Rules

- Never send raw user input back in embeds without sanitization
- Ephemeral replies for errors (not visible to other users)
- All command text must use `@to-much-talker/i18n` message keys — no hardcoded strings
- Respect Discord rate limits: use queued responses for multi-embed flows

## Settings Architecture

- Hierarchy: User ≤ Channel ≤ Server (server settings clamp lower scopes)
- RBAC: `permissions_role_id` per guild enforces who can change settings
- Audit log: every settings write produces a `setting_audit_log` row (90d TTL default)
- IPC: settings changes broadcast from manager to all workers to invalidate LRU cache
- BYOK: per-server OpenRouter API key stored AES-256-GCM encrypted

## Test Policy

- Vitest for unit and integration tests (pyramid model — more unit, fewer integration)
- Playwright + testcontainers for e2e (playground + docs)
- `@to-much-talker/test-utils` ONLY in test files (`**/*.{test,spec}.ts`) — ESLint enforces this
- Coverage threshold: 70% minimum (ratchet up over time)
- No snapshot tests — assert behavior explicitly

## Branch Naming

Follow project Git Flow (from user-level AGENTS.md):

- `feature/*` for new features
- `bugfix/*` for bug fixes
- `hotfix/*` for urgent production fixes
- `refactor/*` for restructuring

Current branch for this scaffold: `feature/scaffold-monorepo`

## Commit Conventions

Conventional Commits enforced via commitlint + lefthook:

- `feat(scope): description` — new feature
- `fix(scope): description` — bug fix
- `build(scope): description` — build system changes
- `ci(scope): description` — CI/CD changes
- `docs(scope): description` — documentation
- `refactor(scope): description` — restructuring
- `test(scope): description` — tests

## Definition of Done

A task is complete when:

1. All specified files exist with correct content
2. `yarn turbo run lint typecheck` exits 0 for affected packages
3. `yarn turbo run test` passes for affected packages
4. No `as any`, no default exports (except config files), no `console.log` outside CLI
5. Every exported function has an explicit return type
6. AGENTS.md exists in the package/app directory
