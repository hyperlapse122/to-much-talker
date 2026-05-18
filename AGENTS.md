# AGENTS

Project-level agent instructions for the **To Much Talker** monorepo.
These rules OVERRIDE the user-level AGENTS.md where they conflict.

> **Scaffold Status**: Initial scaffold complete (May 2026). All 37 implementation tasks executed.
> Build passes: `yarn turbo run lint typecheck test build` — 19 typecheck tasks, 70+ tests, all green.
> Branch: `feature/scaffold-monorepo`
>
> **Multi-arch Docker**: CI multi-arch pipeline live (May 2026). PR #5 open via `feature/multi-arch-docker`.
> All 3 images (server, playground, docs) build for linux/amd64 + linux/arm64 via native runners.
> Pattern: push-by-digest per arch → `docker buildx imagetools create` for manifest assembly.

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
yarn workspace @to-much-talker/server build  # Build server before any run
yarn workspace @to-much-talker/server start  # Run built server from dist
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
8. **Multi-arch Docker** — images built for `linux/amd64` + `linux/arm64`; manifest list assembled via `docker buildx imagetools create` in CI
9. **Apps MUST bundle with Vite 8** — every workspace under `apps/` produces its
   production artifact via `vite build` (not `tsc`). The bundle MUST inline all
   workspace and npm dependencies; `external` / `ssr.noExternal` MUST be
   configured so nothing is left for Node to resolve at runtime — except for
   true native modules that ship `.node` binaries (e.g. `@discordjs/opus`,
   `better-sqlite3`). `tsc` in `apps/` is for type-checking only (`tsc --noEmit`).
   See each app's `AGENTS.md` and `vite.config.ts` for the canonical recipe.
10. **Server runtime MUST use built output** — run `yarn workspace @to-much-talker/server build`
    before starting the bot, then run `yarn workspace @to-much-talker/server start`.
    Do not run server source files directly and do not use `tsx` for server runtime.

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

## Releasing

Release is **fully automated** by [`.github/workflows/release.yml`](.github/workflows/release.yml) on pushes to `main`. The workflow runs `changeset version`, commits the bump, tags `v${VERSION}`, creates the GitHub Release, and dispatches the Docker image build.

**Agents MUST:**

- Add a changeset (`yarn changeset`) for every user-visible change. The interactive prompt selects affected packages and bump type (`major` / `minor` / `patch`); the resulting `.changeset/*.md` file MUST be committed alongside the change.
- Treat the server package's version as the canonical monorepo tag — all public packages bump in lockstep via the changeset.

**Agents MUST NOT:**

- Run `yarn changeset version`, `yarn changeset publish`, `git tag v*`, `gh release create`, or otherwise cut a release locally. The CI workflow owns these steps.
- Manually edit `package.json` versions, `CHANGELOG.md` files, or push tags. These are generated artifacts of `changeset version` running in CI.
- Trigger the Docker workflow by hand on a release tag — `release.yml` dispatches it automatically after the tag is pushed.

If a release appears broken (missed tag, missed Docker build, wrong version bump), stop and report to the user. Do not attempt to "fix it up" by hand-tagging or hand-publishing.

## User Documentation Sync

The public docs site (`apps/docs/`) is the canonical user-facing reference. Agents MUST keep it in sync when code changes affect deployment or configuration.

### Which docs to update

| Code change | Must update |
|---|---|
| Env var added, removed, or renamed in `packages/config/src/schema.ts` | 1. `.env.example` 2. `apps/docs/content/en/guide/setup.md` env table |
| Docker config changed (`containers/*.Dockerfile`, `docker-compose.yml`) | `apps/docs/content/en/guide/setup.md` Docker section |
| CLI command added or changed (`apps/server/src/cli.ts`) | `apps/docs/content/en/guide/commands.md` |
| Runtime startup requirements changed (entrypoint, ports, volumes) | `apps/docs/content/en/guide/setup.md` Docker or source section |
| Key rotation or crypto procedure changed (`packages/crypto/`) | `apps/docs/content/en/guide/setup.md` key-generation section + `apps/server/README.md` |

When in doubt, update the docs. Outdated docs are worse than no docs.

### Canonical locations

- **.env.example** — authoritative env-var manifest (every var, with comments)
- **packages/config/src/schema.ts** — authoritative validation (types, defaults, constraints)
- **apps/docs/content/en/guide/setup.md** — authoritative user-facing getting-started guide
- **apps/docs/AGENTS.md** — canonical docs-site rules (markdown pipeline, frontmatter, build)
- **apps/server/README.md** — developer README (cross-links to docs site; does NOT duplicate)

### Adding a new docs page

1. Create `apps/docs/content/en/<section>/<slug>.md` with frontmatter `title`, `description`, `order`.
2. The sidebar auto-discovers pages from `content-collections` — no manual nav file needed.
3. Rebuild: `yarn workspace @to-much-talker/docs build`. Verify the page appears at `/<section>/<slug>`.

## Definition of Done

A task is complete when:

1. All specified files exist with correct content
2. `yarn turbo run lint typecheck` exits 0 for affected packages
3. `yarn turbo run test` passes for affected packages
4. No `as any`, no default exports (except config files), no `console.log` outside CLI
5. Every exported function has an explicit return type
6. AGENTS.md exists in the package/app directory
7. User-facing docs in sync: env-var, Docker, or startup changes include a corresponding update to `apps/docs/content/en/guide/setup.md`
