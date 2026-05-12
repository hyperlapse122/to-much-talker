# Scaffold & Implement "To Much Talker" — Discord TTS Bot

## TL;DR

> **Quick Summary**: Scaffold a Yarn 4 + Turborepo monorepo for "To Much Talker" — a Discord TTS bot that synthesizes voice via OpenRouter TTS (Gemini/GPT-4o-mini), runs in cluster+shards in a Docker image, and ships with a dev-only TanStack Start playground and an SSR markdown docs site. Strict TS, MIT, three Docker images, Vitest + Playwright (containers), Paraglide i18n (en/ko/ja).
>
> **Deliverables**:
> - `apps/server` — discord.js v14 bot + CLI (cluster manager + worker auto-detect), Docker image
> - `apps/playground` — dev-only TanStack Start + Shadcn/Tailwind v4 playground, localhost-bound
> - `apps/docs` — SSR markdown docs site (GFM + Shiki + admonitions, Pagefind search)
> - `packages/shared` — types, errors, branded IDs, Result helpers
> - `packages/config` — zod-validated env loader
> - `packages/i18n` — Paraglide JS messages (en/ko/ja) + Discord locale mapping helper
> - `packages/crypto` — AES-256-GCM + master key versioning
> - `packages/db` — drizzle-orm dual-dialect (SQLite/Postgres) with discriminated union `Db = SqliteDb | PgDb`
> - `packages/ai` — OpenRouter client (TTS via `openai` SDK + chat via TanStack AI)
> - `packages/settings-core` — settings resolver (clamps), LRU cache, abstract `IpcTransport` interface
> - `packages/test-utils` — mocked Discord interaction builders, ephemeral DB helpers
> - Hierarchical AGENTS.md (root + per app + per package)
> - GH Actions CI + Changesets + lefthook + Conventional Commits
> - LICENSE (MIT), root README, docs guide seed
>
> **Estimated Effort**: XL (~40 tasks across 8 waves + Final Verification)
> **Parallel Execution**: YES — 8 implementation waves; up to 8 concurrent tasks per wave
> **Critical Path**: Root scaffolding → Shared packages → DB & AI → Bot core → Slash commands → Final wave

---

## Context

### Original Request

User asked to plan scaffolding and feature implementation for "To Much Talker", a Discord TTS bot using OpenRouter TTS models (`google/gemini-3.1-flash-tts-preview`, `openai/gpt-4o-mini-tts-2025-12-15`). Components: (a) bot/CLI server with cluster + sharding distributable as Docker; (b) dev-only web playground (TanStack Start + Query + Shadcn + Tailwind v4); (c) docs site rendering markdown (TanStack Start). Settings via slash commands at server / channel / user scope. Drizzle dual-dialect (SQLite + Postgres) with discriminated-union type. TanStack AI for AI features. AGENTS.md files for preferences. User explicitly said: "DON'T ASSUME, ASK ME EVERYTHING."

### Interview Summary (14 rounds)

**All decisions recorded in `.sisyphus/drafts/to-much-talker.md` and consolidated below.**

Key choices:
- Pkg mgr: **Yarn 4 Berry** (preexisting), node-modules linker — **Turborepo**, scope `@to-much-talker/*`, layout `apps/*` + `packages/*`
- Runtime: **Node.js 24**, ESM-only, `.tool-versions`
- TS: **strictest**; **ESLint flat config + Prettier**
- Discord: **discord.js v14** + `@discordjs/voice` + `@discordjs/opus` + `prism-media` + FFmpeg + `sodium-native`
- Sharding: **discord-hybrid-sharding**; per-cluster local state; built-in IPC for settings invalidation
- DB: **drizzle** dual-dialect, `Db = SqliteDb | PgDb` discriminated union; **better-sqlite3** + **postgres** (postgres.js); URL-scheme inference; SQLite default at `./data/bot.db`
- AI: **`openai` SDK with `baseURL: https://openrouter.ai/api/v1` for TTS** (per Metis A1 — TanStack AI has no OpenRouter TTS adapter). TanStack AI used in playground for chat features only.
- Secrets: **AES-256-GCM** with env `MASTER_ENC_KEY`; key versioning; CLI rotation
- Config: env + **zod**; strict required set
- Logger: **pino**
- i18n: **Paraglide JS** with full SSR; locales **en / ko / ja**
- Tests: **Vitest** pyramid + mocked Discord client + **Playwright with containers**
- Docker: `node:24-slim`, **three** separate images, `linux/amd64`, **GHCR**
- CI: **GitHub Actions** + **Changesets** + **lefthook** + Conventional Commits
- License: **MIT**

**Settings architecture**: User ≤ Channel ≤ Server (clamped); per-server BYOK; Discord-role RBAC; pluggable per-channel queue strategy; idle-leave on EITHER text-inactivity OR empty voice channel; `/tts` slash command with subcommand groups; audit log in DB (90d default).

**Bot UX**: per-channel opt-in (`/tts join` + text channel bind); voice join anyone-in-channel; first-run DM owner + `/tts setup` wizard; API key entry via DM Discord modal validated by OpenRouter test-call.

**Web**: playground = TTS sandbox + settings inspector (localhost-bound); docs = SSR + GFM/Shiki/admonitions + Pagefind search + i18n URL prefixes.

### Research Findings (verified via librarian agents + Metis)

- **OpenRouter TTS supported**: `POST /api/v1/audio/speech` (OpenAI-compatible). Returns raw audio bytes.
- **Model IDs validated**: both user-supplied IDs exist on OpenRouter. Still validate at startup against `/api/v1/models`.
- **TanStack AI does NOT have an OpenRouter TTS adapter**: use `openai` SDK directly with `baseURL: 'https://openrouter.ai/api/v1'` for TTS. Do NOT try to coerce TanStack AI's OpenAI TTS adapter with a custom baseURL.
- **discord.js v14**: full voice support via `@discordjs/voice`; requires `sodium-native` + `@discordjs/opus` + FFmpeg in image.
- **discord-hybrid-sharding**: standard for multi-process clustering with built-in IPC.
- **TanStack Start v0**: SSR + static; Vite-based; Tailwind v4 stable; Shadcn New York style works with v4.
- **Drizzle dual-dialect**: parallel `sqliteTable` / `pgTable` schemas; per-dialect migrations via `drizzle.{sqlite,pg}.config.ts`.
- **Paraglide JS**: compile-time tree-shaken; per-message function; helper needed to bridge to Discord slash command `name_localizations` / `description_localizations`.

### Metis Review

Metis confirmed model IDs, directed `openai` SDK direct usage for TTS (not via TanStack AI), and surfaced edge cases (long-message chunking, mention rendering, attachment handling, OpenRouter downtime, voice region, voice channel change mid-playback, race conditions on settings invalidation, reconnect after WS drop). These are baked into specific tasks below.

---

## Work Objectives

### Core Objective

Stand up a production-grade Discord TTS bot codebase that synthesizes voice via OpenRouter TTS, scales via clusters+sharding, ships as Docker, and is accompanied by a dev-only playground and SSR markdown docs site — all in a single Yarn 4 + Turborepo monorepo with strict TypeScript, automated tests, and CI/CD.

### Concrete Deliverables

- Repo top level: `package.json` (workspaces), `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `lefthook.yml`, `.changeset/`, `.tool-versions`, `.gitignore`, `.editorconfig`, `LICENSE` (MIT), `README.md`, `AGENTS.md`, `.github/workflows/{ci,e2e,release,docker}.yml`, `.env.example`
- `apps/server/**` — Discord bot CLI: `apps/server/Dockerfile`, `apps/server/src/{index.ts,cli.ts,bot/**,voice/**,queue/**,commands/**,settings/**,i18n/**,setup/**}`, `apps/server/AGENTS.md`, `apps/server/README.md`
- `apps/playground/**` — TanStack Start app + `Dockerfile` + `AGENTS.md`
- `apps/docs/**` — TanStack Start SSR app + `Dockerfile` + `content/**.md` seed + `AGENTS.md`
- `packages/shared/**`, `packages/config/**`, `packages/i18n/**`, `packages/crypto/**`, `packages/db/**`, `packages/ai/**`, `packages/settings-core/**`, `packages/test-utils/**` — each with `package.json`, `tsconfig.json`, `src/index.ts`, tests, and `AGENTS.md`
- CI workflows + Changesets release flow producing `ghcr.io/<owner>/to-much-talker-{bot,playground,docs}` images on tag

### Definition of Done

- [ ] `yarn install` succeeds from clean clone
- [ ] `yarn turbo run lint typecheck test build` completes with 0 errors
- [ ] `yarn workspace @to-much-talker/server build` produces dist
- [ ] `docker build -f apps/server/Dockerfile -t tmt-bot .` builds successfully
  - [ ] `docker build -f apps/playground/Dockerfile -t tmt-playground .` builds successfully (image binds to 0.0.0.0 internally, with a startup WARNING banner)
- [ ] `docker build -f apps/docs/Dockerfile -t tmt-docs .` builds successfully
- [ ] Bot smoke test: starts, registers slash commands, mocks /tts join, plays mocked TTS, leaves — passes
- [ ] Playground Playwright e2e (TTS sandbox roundtrip) passes
- [ ] Docs Playwright e2e (page renders, Pagefind search works) passes
- [ ] All required AGENTS.md files exist (root + per app + per package, total 11+)
- [ ] LICENSE file is MIT
- [ ] `node --env-file=.env.example apps/server/dist/index.js --version` prints version

### Must Have

- discord.js v14 bot core that joins voice channels, plays Opus audio from a TTS source, supports slash commands
- OpenRouter TTS via `openai` SDK with `baseURL: https://openrouter.ai/api/v1` calling `/audio/speech`
- discord-hybrid-sharding cluster manager auto-spawn at `TOTAL_SHARDS > 1`
- Drizzle dual-dialect: discriminated-union `Db = SqliteDb | PgDb`; URL-scheme inference; parallel schemas; separate migration trees
- AES-256-GCM for API keys at rest with `key_version` column; CLI `key gen` + `key rotate`
- `packages/settings-core` providing the User ≤ Channel ≤ Server (clamped) resolver, LRU cache, and an abstract `IpcTransport` interface; concrete IPC transport plugged in from `apps/server` Task 17
- `/tts` slash command tree with subcommand groups; Discord locale registration from Paraglide messages
- Audit log of settings changes persisted to DB
- First-run owner-DM + `/tts setup` wizard
- API key entry via Discord DM modal with OpenRouter validation
- Pre-flight cost estimate + post-call accounting
- Per-channel pluggable queue strategy interface + 3 built-in implementations (drop-oldest, drop-newest, interrupt)
- Idle leave on EITHER text inactivity OR empty voice channel
- TanStack Start playground (localhost-bound) with TTS sandbox + settings inspector + audit log viewer
- TanStack Start docs site with SSR, GFM + frontmatter + Shiki + admonitions, Pagefind search, locale URL prefixes
- Hierarchical AGENTS.md (root + per app + per package)
- Vitest unit + integration tests; Playwright (containers) e2e for web
- Three Dockerfiles (bot, playground, docs) using `node:24-slim`
- GH Actions: `ci.yml`, `e2e.yml`, `release.yml`, `docker.yml`
- lefthook + commitlint pre-commit hooks
- Changesets release flow → GHCR images on tag
- MIT LICENSE
- Paraglide JS i18n with en/ko/ja; Discord slash command localization

### Must NOT Have (Guardrails)

- **NO** bot-wide fallback API key (per-server BYOK only)
- **NO** Python anywhere in the repo (TS/Node only; scripting via tsx or `node` directly)
- **NO** emojis in code, file content, file names, or commit messages
- **NO** `as any`, no `@ts-ignore` (use `@ts-expect-error` with reason when unavoidable)
- **NO** default exports (named exports only)
- **NO** `console.log` outside CLI entry; use `pino` everywhere else
- **NO** plaintext API keys in DB (always AES-256-GCM)
- **NO** multi-arch builds for v1 (amd64 only)
- **NO** Prometheus / OTel / Sentry / GlitchTip in v1
- **NO** Redis or any external state store
- **NO** versioned docs (single 'latest')
- **NO** TTS streaming (whole-file response only)
- **NO** voice activity detection / speech-to-text
- **NO** audio filters (volume/pitch/speed manipulation)
- **NO** plugin/extension system
- **NO** real Discord token in CI secrets
- **NO** AGPL/BSL — license is MIT
- **NO** TanStack AI's OpenAI TTS adapter pointed at OpenRouter (use `openai` SDK directly per Metis A1)
- **NO** binding the playground to `0.0.0.0` without explicit `PLAYGROUND_ALLOW_ALL=1` escape hatch
- **NO** committing `.env` (only `.env.example`)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed via tools.

### Test Decision

- **Infrastructure exists**: NO (greenfield) → set up in Wave 1
- **Automated tests**: YES (TDD + tests-after hybrid; each task lists explicit tests)
- **Framework**: **Vitest** for unit + integration; **Playwright** (containerized) for web E2E
- **Discord testing**: mocked Discord Client + interactionCreate fixtures via `packages/test-utils`
- **TDD policy**: pure-logic tasks (settings resolver, queue strategies, crypto, cost estimator, dialect type guards) follow RED → GREEN → REFACTOR. Wiring tasks (Dockerfile, CI yaml, scaffolding) use tests-after / structure-only validation.

### QA Policy

Every implementation task includes agent-executed **QA scenarios** with concrete steps, selectors/commands, and an evidence path under `.sisyphus/evidence/`. The orchestrator verifies evidence files exist before marking the task complete.

- **Bot logic** (settings resolver, crypto, queue, cost estimator): Bash + `node --test`/Vitest runner with assertions
- **DB layer**: Bash + Vitest with in-memory SQLite and ephemeral Postgres (via testcontainers if available, else docker run --rm)
- **Slash commands**: Bash + Vitest using mocked Discord interaction builders
- **Voice pipeline**: Bash with a mocked TTS source stream → verify Opus frames produced (count + duration check)
- **Playground/docs UI**: Playwright with containerized browser via `mcr.microsoft.com/playwright:v<version>`
- **Docker builds**: Bash `docker build` + `docker run --rm <image> --version`
- **CLI**: Bash `node dist/cli.js key gen` + parse output

Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — root foundation, 1 task):
└── Task 1: Root monorepo config (workspaces, turbo, tsc, eslint, prettier, lefthook, commitlint, changesets, .tool-versions, .gitignore, LICENSE, root README seed, root AGENTS.md, .editorconfig, .env.example)

Wave 2 (After Wave 1 — shared packages, 6 parallel):
├── Task 2: packages/shared (types, errors, Result, branded IDs, AGENTS.md)
├── Task 3: packages/config (zod env schema, loader, AGENTS.md)
├── Task 4: packages/crypto (AES-256-GCM, key versioning, AGENTS.md)
├── Task 5: packages/i18n (Paraglide setup, locales, Discord locale helper, AGENTS.md)
├── Task 6: packages/test-utils (mocked Discord builders, ephemeral DB helpers, AGENTS.md)
└── Task 7: packages/db schema (parallel sqlite/pg schemas, shared types, AGENTS.md)

Wave 3 (After Wave 2 — cross-cutting, 4 parallel):
├── Task 8: packages/db runtime (Db union, openDb, dialect detect, migration runner)
├── Task 9: packages/db migrations (drizzle.{sqlite,pg}.config.ts, initial migrations)
├── Task 10: packages/ai (OpenRouterClient with capability check, TTS via openai SDK, AGENTS.md)
└── Task 11: packages/settings-core (resolver + cache + abstract IpcTransport interface)

Wave 4 (After Wave 3 — bot core, 5 parallel):
├── Task 12: apps/server scaffolding (entrypoint, CLI parser, role auto-detect, logger, AGENTS.md, README)
├── Task 13: Discord client setup + slash command registry + Paraglide → Discord locale bridge
├── Task 14: Voice pipeline (prism-media + FFmpeg + @discordjs/opus, abstract Player interface)
├── Task 15: Queue strategy interface + 3 built-in implementations (drop-oldest, drop-newest, interrupt)
└── Task 16: Idle behavior (text-inactivity timer + voice-empty detector + combined leave)

Wave 5 (After Wave 4 — bot features, 7 parallel):
├── Task 17: Cluster manager + worker (discord-hybrid-sharding, auto-detect)
├── Task 18: CLI key subcommands (key gen, key rotate)
├── Task 19: Slash commands: /tts join, /tts leave, /tts skip, /tts clear
├── Task 20: Slash commands: /tts say (one-off), /tts stats, /tts help
├── Task 21: Slash commands: /tts settings (server, channel, user) get/set/reset
├── Task 22: Slash commands: /tts setup wizard + /tts settings audit + first-run owner DM
└── Task 23: API key entry via DM Discord modal + OpenRouter validation; pre-flight cost + post-call accounting

Wave 6 (After Wave 5 — web apps, 5 parallel):
├── Task 24: apps/playground scaffolding (TanStack Start + Vite + Tailwind v4 + Shadcn New York + TanStack Query + TanStack Form + Paraglide + localhost bind, AGENTS.md, README)
├── Task 25: apps/playground TTS sandbox page (form + audio playback + mocked OpenRouter toggle)
├── Task 26: apps/playground settings inspector + audit log viewer
├── Task 27: apps/docs scaffolding (TanStack Start SSR + Vite + Tailwind + Pagefind + remark/Shiki/admonitions + content dir + AGENTS.md, README)
└── Task 28: apps/docs content seed (install / configure / commands / security / contributing / architecture pages)

Wave 7 (After Wave 6 — tests, 4 parallel):
├── Task 29: Unit + integration tests (crypto, settings, queue, cost, DB, i18n, slash commands mocked)
├── Task 30: Bot smoke test (mocked Discord — join voice, mocked TTS, leave)
├── Task 31: Playwright e2e (containerized): playground TTS sandbox + settings inspector
└── Task 32: Playwright e2e (containerized): docs page render + Pagefind search + locale routing

Wave 8 (After Wave 7 — deploy & CI, 5 parallel):
├── Task 33: apps/server/Dockerfile (node:24-slim, FFmpeg, multi-stage, non-root user)
├── Task 34: apps/playground/Dockerfile + apps/docs/Dockerfile
├── Task 35: docker-compose example (bot + optional Postgres) + .env.example update
├── Task 36: GH Actions: ci.yml (lint + typecheck + unit/integration tests) + e2e.yml (Playwright with containers)
└── Task 37: GH Actions: release.yml (Changesets) + docker.yml (build & push 3 images to GHCR)

Wave FINAL (After ALL tasks — 4 parallel reviews + user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright skill)
└── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: 1 → (2,3,4,5,6,7) → (8,9,10,11) → (12,13,14,15,16) → (17,18,19,20,21,22,23) → (24,25,26,27,28) → (29,30,31,32) → (33,34,35,36,37) → F1-F4 → user okay
Parallel Speedup: ~75% faster than sequential
Max Concurrent: 7 (Wave 5)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 2–7 |
| 2 (shared) | 1 | 3, 4, 5, 7, 10, 11, 12 |
| 3 (config) | 1, 2 | 8, 10, 11, 12 |
| 4 (crypto) | 1, 2 | 7 (schema), 10, 11, 18 |
| 5 (i18n) | 1, 2 | 13, 19–23, 24, 27 |
| 6 (test-utils) | 1, 2 | 29, 30 |
| 7 (db schema) | 1, 2, 4 | 8, 9, 11 |
| 8 (db runtime) | 7 | 11, 17 |
| 9 (db migrations) | 7 | 17, 35 |
| 10 (ai) | 2, 3 | 23, 25 |
| 11 (settings-core pkg) | 2, 3, 7, 8 | 14, 16, 17, 19–23, 26 |
| 12 (server scaffold) | 2, 3 | 13–23 |
| 13 (discord client) | 5, 12 | 17, 19–23 |
| 14 (voice pipeline) | 11, 12 | 17 |
| 15 (queue) | 2, 11 | 17 |
| 16 (idle) | 11, 14 | 17 |
| 17 (cluster) | 8, 9, 13, 14, 15, 16 | F1 |
| 18 (cli key) | 4, 12 | F1 |
| 19–23 (slash cmds) | 11, 13, (10 for 23) | F1 |
| 24 (playground scaffold) | 5 | 25, 26 |
| 25 (sandbox page) | 10, 24 | 31 |
| 26 (inspector page) | 8, 11, 24 | 31 |
| 27 (docs scaffold) | 5 | 28, 32 |
| 28 (docs content) | 27 | 32 |
| 29 (unit/integ tests) | 6, 4, 7, 11, 15 | F2 |
| 30 (bot smoke) | 6, 17 | F2 |
| 31 (playground e2e) | 25, 26 | F2 |
| 32 (docs e2e) | 28 | F2 |
| 33 (bot Dockerfile) | 17 | F3 |
| 34 (web Dockerfiles) | 25, 28 | F3 |
| 35 (compose example) | 33 | F3 |
| 36 (ci+e2e workflows) | 29–32 | F4 |
| 37 (release+docker workflows) | 33, 34 | F4 |
| F1–F4 | ALL above | — |

### Agent Dispatch Summary

- **Wave 1** (1 task): T1 → `quick`
- **Wave 2** (6 tasks): T2–T7 → mix `quick` (T2, T6) + `unspecified-high` (T3, T4, T5, T7)
- **Wave 3** (4 tasks): T8 → `deep` (dialect union), T9 → `quick`, T10 → `unspecified-high`, T11 → `deep` (resolver logic) — note T11 produces `packages/settings-core` (standalone package, not under apps/server)
- **Wave 4** (5 tasks): T12 → `quick`, T13 → `unspecified-high`, T14 → `deep` (audio pipeline), T15 → `deep` (strategy pattern), T16 → `unspecified-high`
- **Wave 5** (7 tasks): T17 → `deep` (cluster), T18 → `quick`, T19–T22 → `unspecified-high`, T23 → `deep`
- **Wave 6** (5 tasks): T24 → `visual-engineering`, T25–T26 → `visual-engineering`, T27–T28 → `visual-engineering` + `writing` for content
- **Wave 7** (4 tasks): T29 → `unspecified-high`, T30 → `unspecified-high`, T31–T32 → `unspecified-high` (with `playwright-cli` skill)
- **Wave 8** (5 tasks): T33–T34 → `unspecified-high`, T35 → `quick`, T36–T37 → `unspecified-high`
- **Final** (4 tasks): F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high` (with `playwright-cli`), F4 → `deep`

---

## TODOs

- [x] 1. Root monorepo configuration & repo hygiene

  **What to do**:
  - Edit root `package.json`: add `"workspaces": ["apps/*", "packages/*"]`, `"type": "module"`, `"private": true`, scripts (`build`, `lint`, `typecheck`, `test`, `format`, `changeset`)
  - Create `turbo.json` with pipeline tasks: `build` (depends on `^build`), `lint`, `typecheck`, `test`, `dev` (no cache, persistent)
  - Create `tsconfig.base.json` with strictest settings: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2023"`, `lib: ["ES2023"]`, `verbatimModuleSyntax: true`, `isolatedModules: true`, `skipLibCheck: true`
  - Create `eslint.config.js` (flat config) with `@eslint/js`, `typescript-eslint`, rules forbidding default exports, requiring named exports, no `as any`, no `console` outside CLI entry, no emojis in identifiers/strings (custom rule), Conventional Commits enforcement via commitlint
  - Create `.prettierrc.json` (LF, no semis, single quotes, trailing comma all) and `.prettierignore`
  - Create `lefthook.yml`: pre-commit runs lint-staged equivalent (eslint --fix + prettier --write on staged files) + `tsc --noEmit -p tsconfig.base.json` + `commitlint --edit`
  - Create `commitlint.config.js` with Conventional Commits
  - Initialize Changesets: `.changeset/config.json` with `linked: []`, `commit: false`, `access: "public"`, `baseBranch: "main"`, `updateInternalDependencies: "patch"`
  - Create `.tool-versions`: `nodejs 24.x.x` (latest LTS at scaffolding time)
  - Update `.gitignore`: add `dist/`, `.env`, `.env.local`, `.turbo/`, `coverage/`, `.vite/`, `data/`, `.sisyphus/evidence/`, Paraglide compiled output paths, Playwright `test-results/`
  - Update `.editorconfig` (already exists; verify LF, UTF-8, 2-space — match existing)
  - Create `LICENSE` (MIT, year 2026, holder `<owner>`)
  - Update `README.md`: project header, status badges placeholder, quickstart pointing to docs site
  - Create root `AGENTS.md`: all sections per Round 13 (project overview, architecture map, tech stack with rationale, monorepo commands, coding conventions, Discord rules, settings semantics, test policy, branch naming, commit conventions, Definition of Done), explicit project overrides (NO Python; pin Node 24; Conventional Commits enforced)
  - Create `.env.example`: every env var documented with description, required/optional flag, default
  - Create empty `.github/` dir with `CODEOWNERS` placeholder (`* @<owner>`)
  - Configure Yarn 4 plugins as needed: `yarn plugin import workspace-tools`

  **Must NOT do**:
  - Do NOT include Python config files anywhere
  - Do NOT add emoji to any file content
  - Do NOT use default exports anywhere
  - Do NOT commit `.env` (only `.env.example`)
  - Do NOT add Sentry / Prometheus / Redis dependencies
  - Do NOT enable multi-arch in any config yet

  **Recommended Agent Profile**:
  - **Category**: `quick` — repetitive scaffolding, no architectural decisions remaining
    - Reason: All decisions captured upstream; this is mechanical file creation
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `gh-cli`: not needed for local scaffolding

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundational, all other tasks depend on this)
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: 2, 3, 4, 5, 6, 7
  - **Blocked By**: None

  **References**:
  - **Pattern References**: existing files in repo — `package.json`, `.yarnrc.yml`, `.editorconfig`, `.gitignore` (already set up)
  - **External References**:
    - Turborepo config: https://turbo.build/repo/docs/reference/configuration — for `turbo.json` pipeline structure
    - Strictest tsconfig: https://github.com/tsconfig/bases — see `tsconfig.base.json` recipes
    - Changesets monorepo guide: https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md
    - lefthook: https://github.com/evilmartians/lefthook#install — Rust binary install + `lefthook.yml` schema
    - commitlint: https://commitlint.js.org/reference/configuration.html
    - Yarn 4 workspaces: https://yarnpkg.com/features/workspaces
  - **WHY each matters**:
    - tsconfig bases ensures we don't miss any strict-mode flag
    - Turbo config sets the dependency graph that all future tasks consume
    - Changesets config is the lever for release automation

  **Acceptance Criteria**:
  - [ ] `yarn install` succeeds with no warnings about missing peer deps
  - [ ] `yarn turbo run --dry-run build` shows the pipeline correctly resolves
  - [ ] `node --experimental-strip-types -e "import('./tsconfig.base.json',{ assert: { type: 'json' } }).then(m => console.log(m.default.compilerOptions.strict))"` prints `true`
  - [ ] `cat LICENSE | head -2 | tail -1 | grep -q MIT` — succeeds
  - [ ] `test -f AGENTS.md && grep -q "# AGENTS" AGENTS.md` — succeeds
  - [ ] `test -f .env.example && grep -qE "^DISCORD_TOKEN=" .env.example` — succeeds
  - [ ] `! find . -name "*.py" -not -path "./node_modules/*"` — succeeds (no Python anywhere)
  - [ ] `lefthook install && lefthook run pre-commit --files README.md` runs without error

  **QA Scenarios**:

  ```
  Scenario: Fresh install + dry-run build succeeds
    Tool: Bash
    Preconditions: Clean checkout, node 24 + yarn 4 installed
    Steps:
      1. rm -rf node_modules .yarn/cache (start fresh)
      2. yarn install
      3. yarn turbo run --dry-run build
    Expected Result: yarn install completes with exit 0; turbo dry-run lists 0 packages (no apps yet) but exits 0
    Failure Indicators: missing peers, install fails, turbo can't find turbo.json
    Evidence: .sisyphus/evidence/task-1-install-dryrun.log

  Scenario: Lint config rejects forbidden patterns
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. Create /tmp/lint-test.ts containing `export default function foo() {}` (default export)
      2. Run npx eslint /tmp/lint-test.ts using the repo's eslint config
      3. Capture exit code and output
    Expected Result: exit code != 0; output mentions a rule banning default exports
    Failure Indicators: exit 0 (would mean default-export ban not enforced)
    Evidence: .sisyphus/evidence/task-1-eslint-default-export.log
  ```

  **Evidence to Capture**:
  - [ ] `task-1-install-dryrun.log` — install + turbo dry-run output
  - [ ] `task-1-eslint-default-export.log` — eslint rejection of default exports

  **Commit**: YES (single commit)
  - Message: `chore: scaffold monorepo workspaces, turborepo, eslint, prettier, lefthook, changesets`
  - Files: `package.json, turbo.json, tsconfig.base.json, eslint.config.js, .prettierrc.json, .prettierignore, lefthook.yml, commitlint.config.js, .changeset/config.json, .tool-versions, .gitignore, .editorconfig, LICENSE, README.md, AGENTS.md, .env.example, .github/CODEOWNERS`
  - Pre-commit: `yarn install && yarn turbo run --dry-run build`

- [x] 2. `packages/shared` — types, errors, Result, branded IDs

  **What to do**:
  - Create `packages/shared/{package.json,tsconfig.json,src/index.ts,AGENTS.md}`
  - `package.json`: name `@to-much-talker/shared`, type module, exports `./*` → `./src/*.ts` (via Yarn's resolver, no build step needed for internal pkg) or transpile via `tsc -b` (executor chooses; prefer `tsc -b` so external consumers don't depend on TS)
  - `src/result.ts`: `type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }`; helpers `ok(v)`, `err(e)`, `isOk`, `isErr`, `mapResult`, `unwrapOr`
  - `src/errors.ts`: tagged error classes — `AppError` base + `ValidationError`, `PermissionError`, `RateLimitError`, `UpstreamError`, `ConfigError`, `EncryptionError`, `NotFoundError`; each carries `code`, `cause`, `context`
  - `src/ids.ts`: branded ID types — `GuildId`, `ChannelId`, `UserId`, `MessageId`, `ShardId`, `ClusterId` — each is `string & { __brand: 'GuildId' }`; helpers `asGuildId(s: string)`, etc., with zod schema exports
  - `src/types.ts`: shared discriminated unions — `QueueStrategyName = 'drop-oldest' | 'drop-newest' | 'interrupt'`, `LocaleCode = 'en' | 'ko' | 'ja'`, settings scope `Scope = 'server' | 'channel' | 'user'`
  - `src/index.ts`: re-export everything (named only)
  - `AGENTS.md`: states this package is the only place to define cross-cutting types; no domain logic, no I/O; new error types added here; branded ID pattern explained

  **Must NOT do**: no I/O, no business logic, no default exports, no `any`

  **Recommended Agent Profile**:
  - **Category**: `quick` — small typed primitives
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 3, 4, 5, 6, 7
  - **Parallel Group**: Wave 2
  - **Blocks**: 3, 4, 5, 7, 10, 11, 12
  - **Blocked By**: 1

  **References**:
  - **Pattern References**:
    - `tsconfig.base.json` (Task 1) — `extends` here
  - **External References**:
    - Branded types pattern: https://www.totaltypescript.com/concepts/the-prettify-helper (and adjacent articles on branded types)
    - Result pattern (TS-style): https://imhoff.blog/posts/using-results-in-typescript

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/shared tsc --noEmit` exits 0
  - [ ] `yarn workspace @to-much-talker/shared vitest run` exits 0 (tests added in Task 29)
  - [ ] `node --input-type=module -e "import('./packages/shared/src/index.ts').then(m => { if (typeof m.ok !== 'function' || typeof m.asGuildId !== 'function') process.exit(1) })"` (using `tsx` or compiled output) exits 0
  - [ ] `AGENTS.md` exists and explicitly mentions "no I/O" and "no default exports"

  **QA Scenarios**:

  ```
  Scenario: Result helpers compose correctly
    Tool: Bash (Vitest)
    Preconditions: Task 2 complete
    Steps:
      1. Write a temp test: `expect(ok(5)).toEqual({ok:true,value:5}); expect(err('e').error).toBe('e')`
      2. yarn workspace @to-much-talker/shared vitest run (or one-off vitest via npx)
    Expected Result: tests pass
    Failure Indicators: import path errors, type errors, assertion failures
    Evidence: .sisyphus/evidence/task-2-result-helpers.log

  Scenario: Branded IDs reject raw strings at type level
    Tool: Bash
    Preconditions: Task 2 complete
    Steps:
      1. Create /tmp/brand-test.ts: `import { GuildId } from '@to-much-talker/shared'; const g: GuildId = 'raw'` — should fail typecheck
      2. Run `yarn tsc --noEmit /tmp/brand-test.ts`
    Expected Result: tsc errors (assigning raw string to branded type rejected)
    Failure Indicators: tsc exits 0 (branding not working)
    Evidence: .sisyphus/evidence/task-2-brand-type-error.log
  ```

  **Evidence to Capture**:
  - [ ] `task-2-result-helpers.log` — Vitest output
  - [ ] `task-2-brand-type-error.log` — tsc error output

  **Commit**: YES
  - Message: `feat(shared): add types, Result helpers, branded IDs, error classes`
  - Files: `packages/shared/**`

- [x] 3. `packages/config` — env validation with zod

  **What to do**:
  - Create `packages/config/{package.json,tsconfig.json,src/index.ts,src/schema.ts,src/load.ts,AGENTS.md}`
  - Dependencies: `zod`, `@to-much-talker/shared`
  - `src/schema.ts`: top-level `EnvSchema` discriminated by `BOT_ROLE` (`bot|cluster-manager|migrate`) but with a base set:
    - REQUIRED: `DISCORD_TOKEN` (non-empty string), `DISCORD_CLIENT_ID` (snowflake regex), `MASTER_ENC_KEY` (base64 32 bytes → 256 bits, regex check)
    - OPTIONAL with defaults: `DATABASE_URL` (default `sqlite://./data/bot.db`; must start with `sqlite://` | `file:` | `postgres://` | `postgresql://`), `LOG_LEVEL` (default `info`, enum), `TOTAL_SHARDS` (default `'auto'`, else positive int), `CLUSTER_COUNT` (default `1`, positive int), `NODE_ENV` (default `production`, enum), `IDLE_TEXT_INACTIVITY_MS` (default `300000`), `IDLE_LEAVE_ON_EMPTY` (default `true`), `PLAYGROUND_PORT` (default `5173`), `DOCS_PORT` (default `4000`), `PLAYGROUND_MOCK_OPENROUTER` (default `false`), `PLAYGROUND_WRITE_ENABLED` (default `false`), `PLAYGROUND_ALLOW_ALL` (default `false`)
  - `src/load.ts`: `loadConfig()` reads `process.env`, parses with `EnvSchema.safeParse`, returns `Result<Config, ConfigError>`; `loadConfigOrExit()` for entrypoints (logs structured error + remediation hint + `process.exit(1)`)
  - `src/index.ts`: re-exports
  - `AGENTS.md`: env vars are the ONLY config source; never read `process.env` outside this package; never throw inside parsing — return Result; if you add a new env, schema-first

  **Must NOT do**: no file-system reads (load goes through `process.env`; entrypoints handle `.env` via Node's `--env-file`)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 2, 4, 5, 6, 7
  - **Parallel Group**: Wave 2
  - **Blocks**: 8, 10, 11, 12
  - **Blocked By**: 1, 2

  **References**:
  - **External References**:
    - Zod docs: https://zod.dev/?id=basic-usage
    - Node `--env-file`: https://nodejs.org/api/cli.html#--env-fileconfig
    - 12-factor config: https://12factor.net/config

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` exits 0
  - [ ] Calling `loadConfig({ DISCORD_TOKEN: 'x', DISCORD_CLIENT_ID: '12345678901234567', MASTER_ENC_KEY: '<valid-b64-32>' })` returns `{ ok: true, value: {...} }`
  - [ ] Calling `loadConfig({})` returns `{ ok: false, error: ConfigError }` with details about each missing var

  **QA Scenarios**:

  ```
  Scenario: Valid env passes validation
    Tool: Bash (node --input-type=module)
    Preconditions: Task 3 complete
    Steps:
      1. Run: DISCORD_TOKEN=x DISCORD_CLIENT_ID=123456789012345678 MASTER_ENC_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") node --import tsx -e "import('@to-much-talker/config').then(m => { const r = m.loadConfig(process.env); if (!r.ok) { console.error(r.error); process.exit(2) } console.log('ok') })"
    Expected Result: stdout 'ok', exit 0
    Failure Indicators: exit != 0; any error
    Evidence: .sisyphus/evidence/task-3-valid-env.log

  Scenario: Missing required env fails with detailed errors
    Tool: Bash
    Preconditions: Task 3 complete
    Steps:
      1. Run: unset DISCORD_TOKEN DISCORD_CLIENT_ID MASTER_ENC_KEY; node --import tsx -e "import('@to-much-talker/config').then(m => { const r = m.loadConfig({}); if (r.ok) process.exit(2); console.log(JSON.stringify(r.error.context, null, 2)) })"
    Expected Result: stdout JSON listing all three missing keys; exit 0 (because we caught and printed); no thrown unhandled error
    Failure Indicators: exit code 2 (parse succeeded when it shouldn't); unhandled promise rejection
    Evidence: .sisyphus/evidence/task-3-missing-env.log
  ```

  **Evidence to Capture**:
  - [ ] `task-3-valid-env.log`, `task-3-missing-env.log`

  **Commit**: YES
  - Message: `feat(config): add zod-validated env schema and loader`
  - Files: `packages/config/**`

- [x] 4. `packages/crypto` — AES-256-GCM with key versioning

  **What to do**:
  - Create `packages/crypto/{package.json,tsconfig.json,src/{index.ts,gcm.ts,keys.ts},AGENTS.md}`
  - Dependencies: only Node `crypto` builtins + `@to-much-talker/shared` for `Result`/error types; ZERO external crypto deps (use Node's built-in `crypto.createCipheriv('aes-256-gcm', ...)`)
  - `src/gcm.ts`: pure functions
    - `encrypt(plaintext: string, key: Buffer): { iv: Buffer; ciphertext: Buffer; authTag: Buffer }` — IV is 12 random bytes
    - `decrypt({ iv, ciphertext, authTag }, key: Buffer): Result<string, EncryptionError>` — wraps cipher errors
    - `encode({iv,ciphertext,authTag}): string` — packs as `v1:<b64iv>:<b64ct>:<b64tag>` (versioned envelope; `v1` is the envelope-format version, not the key version)
    - `decode(s: string): Result<{iv,ciphertext,authTag}, EncryptionError>`
  - `src/keys.ts`:
    - `generateMasterKey(): string` — returns base64 of `crypto.randomBytes(32)`
    - `parseMasterKey(s: string): Result<Buffer, EncryptionError>` — validates b64 + 32-byte length
    - Multi-key support: `KeyRing` class with `addKey(version: number, key: Buffer)`, `current()`, `byVersion(v: number)` — used by rotation
  - `src/index.ts` re-exports
  - `AGENTS.md`: never log key material; always use `KeyRing` to decrypt records (handles version lookup); rotation procedure documented; never accept user-supplied keys without `parseMasterKey` validation

  **Must NOT do**: no third-party crypto libs; no key material in logs

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — security-critical
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 2, 3, 5, 6
  - **Parallel Group**: Wave 2
  - **Blocks**: 7 (db schema references encrypted column conventions), 10, 11, 18
  - **Blocked By**: 1, 2

  **References**:
  - **External References**:
    - Node crypto AES-GCM: https://nodejs.org/api/crypto.html#class-cipher (see GCM examples)
    - NIST SP 800-38D (GCM spec): https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf — for IV-size and auth-tag rationale (informational)

  **Acceptance Criteria**:
  - [ ] Roundtrip property test: `decrypt(encrypt(p, k), k).value === p` for 100 random plaintexts (added in Task 29)
  - [ ] Decryption with wrong key returns `{ ok: false, error: EncryptionError }`, not a thrown exception
  - [ ] `KeyRing.byVersion(99)` (unknown version) returns `undefined`; decryption path returns `Result.err`
  - [ ] No key material logged (verified by grep `console.log` + `pino` calls — there are none in this package)

  **QA Scenarios**:

  ```
  Scenario: Encrypt-decrypt roundtrip preserves plaintext
    Tool: Bash (node --import tsx -e)
    Preconditions: Task 4 complete
    Steps:
      1. Run: node --import tsx -e "import('@to-much-talker/crypto').then(m => { const k = Buffer.from(m.generateMasterKey(), 'base64'); const e = m.encrypt('secret-payload', k); const d = m.decrypt(e, k); if (!d.ok || d.value !== 'secret-payload') process.exit(2); console.log('ok') })"
    Expected Result: stdout 'ok'; exit 0
    Failure Indicators: exit 2; any thrown error
    Evidence: .sisyphus/evidence/task-4-roundtrip.log

  Scenario: Wrong key returns Result.err (no throw)
    Tool: Bash
    Preconditions: Task 4 complete
    Steps:
      1. Run: node --import tsx -e "import('@to-much-talker/crypto').then(m => { const k1 = Buffer.from(m.generateMasterKey(), 'base64'); const k2 = Buffer.from(m.generateMasterKey(), 'base64'); const e = m.encrypt('x', k1); const d = m.decrypt(e, k2); if (d.ok) process.exit(2); console.log(d.error.code) })"
    Expected Result: stdout shows error code (e.g. 'DECRYPT_FAILED'); exit 0 (no throw)
    Failure Indicators: thrown exception or exit 2
    Evidence: .sisyphus/evidence/task-4-wrong-key.log
  ```

  **Evidence to Capture**:
  - [ ] `task-4-roundtrip.log`, `task-4-wrong-key.log`

  **Commit**: YES
  - Message: `feat(crypto): add AES-256-GCM encrypt/decrypt with key versioning`
  - Files: `packages/crypto/**`

- [x] 5. `packages/i18n` — Paraglide JS setup with en/ko/ja + Discord locale helper

  **What to do**:
  - Create `packages/i18n/{package.json,tsconfig.json,inlang/project.json,messages/{en,ko,ja}.json,src/{index.ts,discord.ts,locales.ts},AGENTS.md}`
  - Dependencies: `@inlang/paraglide-js`, `@inlang/sdk`, `@to-much-talker/shared`
  - `inlang/project.json`: Paraglide settings declaring source-language `en`, languages `['en','ko','ja']`, plugin `m-function-matcher` and `messageFormat` for JSON
  - `messages/{en,ko,ja}.json`: seed with the minimum strings needed for `/tts setup`, `/tts join`, `/tts leave`, `/tts say`, `/tts skip`, `/tts clear`, `/tts stats`, `/tts help`, `/tts settings *`, plus generic errors (`error.no_api_key`, `error.unauthorized`, `error.over_budget`, etc.)
  - `package.json` scripts: `"compile": "paraglide-js compile --project ./inlang/project.json --outdir ./src/paraglide"`, `"build": "yarn compile && tsc -b"`
  - `src/locales.ts`: `LOCALES = ['en','ko','ja'] as const`; `type Locale = (typeof LOCALES)[number]`; `DEFAULT_LOCALE = 'en'`
  - `src/discord.ts`: `discordLocaleOf(locale: Locale): string` mapping `'en'→'en-US'`, `'ko'→'ko'`, `'ja'→'ja'`; `buildLocalizations(messageKey: keyof Messages): { name_localizations, description_localizations }` — iterates Paraglide's compiled per-locale snapshots to produce Discord's localization payload
  - `src/index.ts`: re-export Paraglide's `m` (messages) + `setLanguageTag`, `availableLanguageTags`, plus our locale helpers
  - `AGENTS.md`: every user-facing string MUST be in messages/; never inline English; new locales added in `locales.ts` AND added to `inlang/project.json`; run `yarn compile` after changing messages; Discord locale code mapping lives in `discord.ts`

  **Must NOT do**: never inline user-visible strings; never commit Paraglide compiled output (add to .gitignore in Task 1)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 2, 3, 4, 6, 7
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 19, 20, 21, 22, 23, 24, 27
  - **Blocked By**: 1, 2

  **References**:
  - **External References**:
    - Paraglide JS docs: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
    - Discord slash command localization: https://discord.com/developers/docs/interactions/application-commands#localization

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/i18n compile` succeeds and creates `src/paraglide/messages.js` + per-locale files
  - [ ] `tsc --noEmit` after compile succeeds
  - [ ] Calling `m.tts_join_success({ channel: 'general' })` returns a non-empty string in the default locale
  - [ ] `buildLocalizations('tts_join_success')` returns an object with `name_localizations` keyed by Discord locale codes for ko + ja

  **QA Scenarios**:

  ```
  Scenario: Paraglide compile produces all 3 locales
    Tool: Bash
    Preconditions: Task 5 complete
    Steps:
      1. Run: yarn workspace @to-much-talker/i18n compile
      2. ls packages/i18n/src/paraglide/
    Expected Result: directory contains files for en, ko, ja
    Failure Indicators: missing locale files; compile errors
    Evidence: .sisyphus/evidence/task-5-compile.log

  Scenario: Discord localization payload structure
    Tool: Bash
    Preconditions: Task 5 complete + compile done
    Steps:
      1. Run: node --import tsx -e "import('@to-much-talker/i18n').then(m => { const x = m.buildLocalizations('tts_join_success'); if (!x.name_localizations.ko || !x.name_localizations.ja) process.exit(2); console.log('ok') })"
    Expected Result: stdout 'ok'; exit 0
    Failure Indicators: missing ko/ja keys in payload
    Evidence: .sisyphus/evidence/task-5-discord-payload.log
  ```

  **Evidence to Capture**:
  - [ ] `task-5-compile.log`, `task-5-discord-payload.log`

  **Commit**: YES
  - Message: `feat(i18n): set up Paraglide JS with en/ko/ja locales and Discord locale helper`
  - Files: `packages/i18n/**`

- [x] 6. `packages/test-utils` — mocked Discord interaction builders + ephemeral DB helpers

  **What to do**:
  - Create `packages/test-utils/{package.json,tsconfig.json,src/{index.ts,discord.ts,db.ts,fixtures.ts},AGENTS.md}`
  - Dependencies: `discord.js`, `@to-much-talker/shared`, `@to-much-talker/db` (peer)
  - `src/discord.ts`: builders
    - `mockGuild({id?, name?, ownerId?})`
    - `mockChannel({id?, type?, guildId?})` (text + voice variants)
    - `mockUser({id?, locale?, permissions?})`
    - `mockChatInputInteraction({guild, channel, user, commandName, subcommand?, options?})` returning a shape compatible with `discord.js.ChatInputCommandInteraction` (Proxy-based, only typed surface used by our handlers)
    - `expectReply(interaction, predicate)` — captures `reply()`/`editReply()` calls
  - `src/db.ts`: `openEphemeralDb({dialect: 'sqlite'|'pg'}): Promise<Db>` — sqlite returns in-memory; pg starts a postgres testcontainer (use `testcontainers` package) or, if `RUN_PG_TESTS=1` is unset, returns a stub that throws "set RUN_PG_TESTS=1"
  - `src/fixtures.ts`: seed helpers (`seedGuildSettings(db, {...})`, `seedChannelSettings`, `seedUserSettings`)
  - `AGENTS.md`: this package is ONLY for tests; never import from non-test code; mocks are typed via Proxy not full Discord.js types

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES with 2, 3, 4, 5, 7
  - **Parallel Group**: Wave 2
  - **Blocks**: 29, 30
  - **Blocked By**: 1, 2

  **References**:
  - **External References**:
    - testcontainers Node.js: https://node.testcontainers.org/quickstart/

  **Acceptance Criteria**:
  - [ ] `mockChatInputInteraction({...})` returns an object where `reply` is a Jest/Vitest mock fn
  - [ ] `openEphemeralDb({dialect:'sqlite'})` returns a working `Db` instance (in-memory)
  - [ ] Importing from non-test code triggers an ESLint warning (rule defined in Task 1 eslint config: `no-restricted-imports` for `@to-much-talker/test-utils` outside `**/*.{test,spec}.ts` and `**/test-utils/**`)

  **QA Scenarios**:

  ```
  Scenario: Mocked interaction captures replies
    Tool: Bash
    Preconditions: Task 6 complete
    Steps:
      1. Run: node --import tsx -e "import('@to-much-talker/test-utils').then(async m => { const i = m.mockChatInputInteraction({commandName:'tts',subcommand:'join'}); await i.reply('hello'); if (i.reply.mock.calls.length !== 1) process.exit(2); console.log('ok') })"
    Expected Result: stdout 'ok'
    Failure Indicators: exit 2; mock not capturing call
    Evidence: .sisyphus/evidence/task-6-mock-interaction.log

  Scenario: Ephemeral SQLite db opens and closes cleanly
    Tool: Bash
    Preconditions: Task 6 complete + Task 7 (schema) done; tests run in Wave 7
    Steps:
      1. (run as part of integration tests in Task 29)
    Expected Result: opens without error, basic insert/select works, closes without leaks
    Evidence: .sisyphus/evidence/task-6-ephemeral-db.log (deferred to Task 29 results)
  ```

  **Evidence to Capture**:
  - [ ] `task-6-mock-interaction.log` (ephemeral-db evidence captured in Task 29)

  **Commit**: YES
  - Message: `feat(test-utils): add mocked Discord interaction builders and ephemeral DB helpers`
  - Files: `packages/test-utils/**`

- [x] 7. `packages/db` — parallel SQLite & Postgres schemas + shared types

  **What to do**:
  - Create `packages/db/{package.json,tsconfig.json,src/{index.ts,types.ts,sqlite/schema.ts,pg/schema.ts},AGENTS.md}`
  - Dependencies: `drizzle-orm`, `better-sqlite3`, `postgres` (postgres.js), `@to-much-talker/shared`
  - Tables (mirrored in both dialects):
    - `guild_settings` (guild_id PK, api_key_encrypted text nullable, api_key_iv text nullable, api_key_auth_tag text nullable, api_key_version int nullable, allowed_models json array, default_model text, default_voice text nullable, max_chars int, max_price_cents int nullable, idle_text_inactivity_ms int, idle_leave_on_empty bool, permissions_role_id text nullable, locale text default 'en', created_at, updated_at)
    - `channel_settings` (guild_id, channel_id, PK = (guild_id, channel_id), max_chars nullable (override), max_queue_size int default 20, queue_strategy text default 'drop-oldest', queue_strategy_params json, bound_text_channel_id text nullable, created_at, updated_at)
    - `user_settings` (user_id PK, preferred_model text nullable, preferred_voice text nullable, preferred_locale text nullable, created_at, updated_at)
    - `setting_audit_log` (id PK auto-inc, guild_id, channel_id nullable, user_id nullable, scope, key, old_value json, new_value json, actor_id, ts)
    - `tts_message_log` (id PK, guild_id, channel_id, user_id, model, char_count, est_cost_micros bigint, actual_cost_micros bigint nullable, queued_at, played_at nullable, error text nullable)
  - `src/types.ts`: re-export inferred row + insert types via `$inferSelect` / `$inferInsert` — UNION across dialects where types match (they should, since column types are equivalent semantically; Drizzle infers per-dialect). Use a TS helper to define `GuildSettings = SqliteGuildSettingsRow | PgGuildSettingsRow` if needed; in practice we type these structurally so they're identical
  - `src/index.ts`: barrel re-export of schemas + types + dialect-aware helpers (to come in Task 8)
  - `AGENTS.md`: parallel-schema discipline — every table change must be reflected in BOTH `sqlite/schema.ts` AND `pg/schema.ts`; column types must be semantically equivalent across dialects (use `text` over `varchar`, `integer` over `int4`, etc.); no dialect-specific features in schema (no Postgres `jsonb` indexes, no SQLite `rowid` hacks); migrations come in Task 9

  **Must NOT do**: NO dialect-specific schema features that would diverge the type surfaces

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — schema decisions matter
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 2, 3, 4, 5, 6
  - **Parallel Group**: Wave 2
  - **Blocks**: 8, 9, 11
  - **Blocked By**: 1, 2, 4 (for encrypted-column conventions)

  **References**:
  - **External References**:
    - Drizzle SQLite: https://orm.drizzle.team/docs/get-started-sqlite
    - Drizzle Postgres: https://orm.drizzle.team/docs/get-started-postgresql
    - Drizzle schema reference: https://orm.drizzle.team/docs/schemas

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` exits 0
  - [ ] Both `sqlite/schema.ts` and `pg/schema.ts` export the same table names
  - [ ] Inferred types are structurally compatible (a TS test asserts `GuildSettings` from sqlite is assignable to `GuildSettings` from pg and vice versa)

  **QA Scenarios**:

  ```
  Scenario: Schema parity between dialects
    Tool: Bash
    Preconditions: Task 7 complete
    Steps:
      1. Extract table names from each schema via a temp script: list `Object.keys` of imports from both files
      2. diff the two name lists
    Expected Result: diff is empty (identical table sets)
    Failure Indicators: any difference in table or column names
    Evidence: .sisyphus/evidence/task-7-schema-parity.log

  Scenario: Inferred types compile bidirectionally
    Tool: Bash
    Preconditions: Task 7 complete
    Steps:
      1. Create /tmp/parity-test.ts: assigns SQLite-inferred `GuildSettings` to Postgres-inferred `GuildSettings` variable and vice versa
      2. yarn tsc --noEmit /tmp/parity-test.ts
    Expected Result: exits 0 (types compatible)
    Failure Indicators: tsc errors
    Evidence: .sisyphus/evidence/task-7-type-parity.log
  ```

  **Evidence to Capture**:
  - [ ] `task-7-schema-parity.log`, `task-7-type-parity.log`

  **Commit**: YES
  - Message: `feat(db): add parallel SQLite and Postgres schemas with shared inferred types`
  - Files: `packages/db/{package.json,tsconfig.json,src/{index.ts,types.ts,sqlite/schema.ts,pg/schema.ts}}`

- [x] 8. `packages/db` runtime — `Db = SqliteDb | PgDb` discriminated union, openDb, dialect detection

  **What to do**:
  - Add `packages/db/src/{client.ts,dialect.ts,sqlite/client.ts,pg/client.ts,migrate.ts}`
  - `src/dialect.ts`: `type Dialect = 'sqlite' | 'pg'`; `detectDialect(url: string): Result<Dialect, ConfigError>` — `sqlite://`/`file:` → sqlite; `postgres://`/`postgresql://` → pg; else error
  - `src/sqlite/client.ts`: `openSqlite(url: string)` returns `{ dialect: 'sqlite' as const, db: drizzle(better-sqlite3 instance), raw: <sqlite>, close() }`
  - `src/pg/client.ts`: `openPg(url: string)` returns `{ dialect: 'pg' as const, db: drizzle(postgres instance), raw: <postgres>, close() }`
  - `src/client.ts`:
    - `type SqliteDb = ReturnType<typeof openSqlite>; type PgDb = ReturnType<typeof openPg>`
    - `type Db = SqliteDb | PgDb`
    - `openDb(url: string): Promise<Db>` — dispatches by `detectDialect`
    - Type-narrowing helpers: `isSqlite(db: Db): db is SqliteDb`, `isPg(db: Db): db is PgDb`
  - `src/migrate.ts`: `runMigrations(db: Db)` — picks `drizzle-orm/better-sqlite3/migrator` or `drizzle-orm/postgres-js/migrator` based on discriminant; reads from `packages/db/migrations/{sqlite,pg}` directories
  - Update `src/index.ts`: export all of the above
  - Update `AGENTS.md`: ALWAYS branch on `db.dialect === 'sqlite'` (or use `isSqlite`/`isPg`) for any dialect-specific query; SHARED domain queries should use Drizzle's portable functions

  **Recommended Agent Profile**:
  - **Category**: `deep` — discriminated-union with proper type narrowing matters
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 9, 10, 11
  - **Parallel Group**: Wave 3
  - **Blocks**: 11, 17
  - **Blocked By**: 7

  **References**:
  - **External References**:
    - Drizzle migrator: https://orm.drizzle.team/docs/migrations
    - postgres.js docs: https://github.com/porsager/postgres
    - better-sqlite3: https://github.com/WiseLibs/better-sqlite3

  **Acceptance Criteria**:
  - [ ] `openDb('sqlite::memory:')` returns a working Db with `dialect === 'sqlite'`
  - [ ] `detectDialect('postgres://x')` returns `{ ok: true, value: 'pg' }`
  - [ ] `detectDialect('mysql://x')` returns `{ ok: false, error: ConfigError }`
  - [ ] Type test: in a function `function test(db: Db) { if (isSqlite(db)) { db.dialect /* should be 'sqlite' */ } }` — tsc accepts

  **QA Scenarios**:

  ```
  Scenario: openDb works for in-memory SQLite
    Tool: Bash
    Preconditions: Task 8 complete; migrations not required (just open)
    Steps:
      1. Run: node --import tsx -e "import('@to-much-talker/db').then(async m => { const db = await m.openDb('sqlite::memory:'); if (db.dialect !== 'sqlite') process.exit(2); await db.close(); console.log('ok') })"
    Expected Result: stdout 'ok'
    Failure Indicators: any error; wrong dialect
    Evidence: .sisyphus/evidence/task-8-open-sqlite.log

  Scenario: Bad URL returns Result.err (no throw)
    Tool: Bash
    Preconditions: Task 8 complete
    Steps:
      1. Run: node --import tsx -e "import('@to-much-talker/db').then(m => { const r = m.detectDialect('mysql://x'); if (r.ok) process.exit(2); console.log(r.error.code) })"
    Expected Result: stdout error code; exit 0
    Failure Indicators: throw, or 'ok' result
    Evidence: .sisyphus/evidence/task-8-bad-url.log
  ```

  **Evidence to Capture**:
  - [ ] `task-8-open-sqlite.log`, `task-8-bad-url.log`

  **Commit**: YES
  - Message: `feat(db): add Db discriminated union, dialect detection, and openDb runtime`
  - Files: `packages/db/src/{client.ts,dialect.ts,sqlite/client.ts,pg/client.ts,migrate.ts,index.ts}, packages/db/AGENTS.md`

- [x] 9. `packages/db` migrations & drizzle-kit configs

  **What to do**:
  - Create `packages/db/{drizzle.sqlite.config.ts,drizzle.pg.config.ts}` — drizzle-kit configs
    - SQLite config: dialect: sqlite, schema: `./src/sqlite/schema.ts`, out: `./migrations/sqlite`, dbCredentials: `{ url: process.env.DATABASE_URL ?? 'sqlite://./data/bot.db' }`
    - Postgres config: dialect: postgresql, schema: `./src/pg/schema.ts`, out: `./migrations/pg`
  - `package.json` scripts:
    - `"migrate:gen:sqlite": "drizzle-kit generate --config=drizzle.sqlite.config.ts"`
    - `"migrate:gen:pg": "drizzle-kit generate --config=drizzle.pg.config.ts"`
    - `"migrate:gen": "yarn migrate:gen:sqlite && yarn migrate:gen:pg"`
  - Run `yarn migrate:gen` once to produce initial `0000_*.sql` in each `migrations/{sqlite,pg}` directory; commit the generated migrations
  - Update `AGENTS.md`: when changing schema → update BOTH schema files → run `yarn workspace @to-much-talker/db migrate:gen` → commit both generated SQL files in the same commit; never hand-edit generated SQL

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 8, 10, 11
  - **Parallel Group**: Wave 3
  - **Blocks**: 17, 35
  - **Blocked By**: 7

  **References**:
  - **External References**:
    - drizzle-kit: https://orm.drizzle.team/docs/drizzle-kit

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/db migrate:gen` succeeds for both dialects
  - [ ] `packages/db/migrations/sqlite/0000_*.sql` and `packages/db/migrations/pg/0000_*.sql` exist
  - [ ] SQL files contain CREATE TABLE statements for all 5 tables (each dialect)
  - [ ] `runMigrations(sqliteDb)` (from Task 8) applies migrations successfully against in-memory SQLite

  **QA Scenarios**:

  ```
  Scenario: Migration generation produces SQL for both dialects
    Tool: Bash
    Preconditions: Task 9 complete
    Steps:
      1. rm -rf packages/db/migrations/{sqlite,pg}
      2. yarn workspace @to-much-talker/db migrate:gen
      3. ls packages/db/migrations/sqlite/*.sql && ls packages/db/migrations/pg/*.sql
    Expected Result: both ls succeed, files exist and non-empty
    Failure Indicators: missing files; empty files
    Evidence: .sisyphus/evidence/task-9-migrate-gen.log

  Scenario: SQLite migration applies cleanly to in-memory db
    Tool: Bash
    Preconditions: Task 9 complete + Task 8 complete
    Steps:
      1. Run: node --import tsx -e "import('@to-much-talker/db').then(async m => { const db = await m.openDb('sqlite::memory:'); await m.runMigrations(db); console.log('ok') })"
    Expected Result: stdout 'ok'
    Failure Indicators: SQL errors; missing migrations dir
    Evidence: .sisyphus/evidence/task-9-apply-sqlite.log
  ```

  **Evidence to Capture**:
  - [ ] `task-9-migrate-gen.log`, `task-9-apply-sqlite.log`

  **Commit**: YES
  - Message: `feat(db): add drizzle-kit configs and initial migrations for both dialects`
  - Files: `packages/db/{drizzle.sqlite.config.ts,drizzle.pg.config.ts,package.json}, packages/db/migrations/**`

- [x] 10. `packages/ai` — OpenRouter client (TTS via `openai` SDK; chat via TanStack AI)

  **What to do**:
  - Create `packages/ai/{package.json,tsconfig.json,src/{index.ts,client.ts,tts.ts,chat.ts,pricing.ts,validate.ts},AGENTS.md}`
  - Dependencies: `openai` (npm package), `zod`, `@to-much-talker/shared`, `@to-much-talker/config`. TanStack AI for chat features is **playground-only**; this package does NOT import TanStack AI (per Metis A1)
  - `src/client.ts`: `class OpenRouterClient` constructed with `{ apiKey, baseURL = 'https://openrouter.ai/api/v1', http? }`; wraps an `OpenAI` SDK instance with `baseURL` set
  - `src/tts.ts`: `synthesize({ model, voice?, input }): Promise<Result<{audio: Buffer; format: 'mp3'|'wav'|'opus'|'pcm'|'aac'; usage?: {...}}, UpstreamError>>`
    - Calls `client.audio.speech.create({ model, voice, input, response_format })`
    - Reads raw audio bytes
    - Parses any `OpenRouter-Usage` headers if present
    - Wraps errors as `UpstreamError` with `kind: 'rate_limit'|'auth'|'bad_request'|'server'|'timeout'`
    - Hard timeout via `AbortSignal.timeout(30_000)` (configurable)
  - `src/validate.ts`: `validateModel(client, modelId): Promise<Result<{exists: boolean; pricing?: {...}}, UpstreamError>>` — queries `GET /api/v1/models`, looks up by id
  - `src/pricing.ts`: `estimateCost({ model, text, pricing }): number` — char-based for TTS pricing
  - `AGENTS.md`: ONLY package allowed to import `openai` SDK; never log API keys; always check OpenRouter response status before reading body; treat 429 as retryable with backoff (caller's responsibility)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 8, 9, 11
  - **Parallel Group**: Wave 3
  - **Blocks**: 23, 25
  - **Blocked By**: 1, 2, 3

  **References**:
  - **External References**:
    - OpenRouter API: https://openrouter.ai/docs (API reference for /audio/speech, /models, error envelope)
    - `openai` Node SDK: https://github.com/openai/openai-node#using-an-openai-compatible-server (baseURL config)
    - Metis A1 directive: TTS via `openai` SDK with OpenRouter baseURL; NO TanStack AI for TTS

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` exits 0
  - [ ] `synthesize({ model, input: 'hi' })` called against a mock server returns `{ ok: true, value: { audio: Buffer, format: 'mp3' } }` for a 200 response with audio body
  - [ ] `synthesize` with mock 401 returns `{ ok: false, error: UpstreamError({ kind: 'auth' }) }` without throwing
  - [ ] `validateModel(client, 'google/gemini-3.1-flash-tts-preview')` with mock `/models` returning that ID returns `{ ok: true, value: { exists: true } }`

  **QA Scenarios**:

  ```
  Scenario: synthesize() against mock server returns audio bytes
    Tool: Bash
    Preconditions: Task 10 complete
    Steps:
      1. Start a tiny http server on 127.0.0.1:0 (Node's http) that responds to POST /audio/speech with content-type audio/mpeg and body = Buffer.from([0xff,0xfb,0x90])
      2. Construct OpenRouterClient with baseURL pointing to that server
      3. Call client.synthesize({model:'fake', input:'hi'})
      4. Assert result.ok === true; result.value.audio.length === 3
    Expected Result: assertion passes; tear down server
    Failure Indicators: error result; wrong byte count
    Evidence: .sisyphus/evidence/task-10-synth-mock.log

  Scenario: 401 from upstream returns auth UpstreamError (no throw)
    Tool: Bash
    Preconditions: Task 10 complete
    Steps:
      1. Mock server returns 401 + JSON `{error:{message:'invalid api key'}}`
      2. Call synthesize → assert result.ok === false && result.error.kind === 'auth'
    Expected Result: assertion passes
    Failure Indicators: throw; wrong error kind
    Evidence: .sisyphus/evidence/task-10-synth-401.log
  ```

  **Evidence to Capture**:
  - [ ] `task-10-synth-mock.log`, `task-10-synth-401.log`

  **Commit**: YES
  - Message: `feat(ai): add OpenRouter client with TTS via openai SDK, model validation, cost estimation`
  - Files: `packages/ai/**`

- [x] 11. `packages/settings-core` — resolver, cache, IPC invalidator (standalone package)

  **What to do**:
  - Create `packages/settings-core/{package.json,tsconfig.json,src/{index.ts,resolver.ts,cache.ts,events.ts,clamps.ts,policy.ts},AGENTS.md}`
  - This is a STANDALONE package so it can be consumed by both `apps/server` (Task 12+) and `apps/playground` (Task 26) without circular dependency. It depends on `@to-much-talker/shared`, `@to-much-talker/db`, `@to-much-talker/config`. It does NOT depend on `apps/server`.
  - `resolver.ts`: `resolveSettings({serverSettings, channelSettings, userSettings, key}): ResolvedValue` — implements `User ≤ Channel ≤ Server (clamped)` per-key policy
  - `policy.ts`: declares per-key behavior: which keys clamp (numeric: `max_chars`, `max_price_cents`, etc.), which override (`preferred_model` if in allowed list, `preferred_voice`), which only-server-wins (`allowed_models`, `api_key_*`, `permissions_role_id`)
  - `clamps.ts`: numeric clamp helpers + allowlist intersection helpers; pure functions
  - `cache.ts`: `SettingsCache` LRU keyed by `(guildId, channelId?, userId?)` → resolved value; max 10_000 entries; TTL 10min as safety net
  - `events.ts`: defines an abstract `IpcTransport` interface (`broadcastInvalidate`, `onInvalidate`); concrete implementation bound by the consumer (apps/server provides `HybridShardingIpcTransport` in Task 17, playground uses a noop transport for read-only inspection)
  - Unit tests in this package's own `__tests__/` directory; run via Vitest
  - `AGENTS.md`: this package is the SOLE owner of settings semantics; consumers MUST go through `resolveSettings`; never duplicate clamping logic; the cache + IPC transport are pluggable to keep this package free of Discord-specific dependencies

  **Must NOT do**: NO direct DB writes here — settings module READS db; writes are done by slash command handlers (Task 21) that call `cache.invalidate(...)` + emit via the transport; NO discord.js imports in this package

  **Recommended Agent Profile**:
  - **Category**: `deep` — clamping semantics + policy table + IPC integration
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 8, 9, 10
  - **Parallel Group**: Wave 3
  - **Blocks**: 14, 16, 17, 19, 20, 21, 22, 23, 26
  - **Blocked By**: 2, 3, 7, 8

  **References**:
  - **Pattern References**:
    - Round 7 in `.sisyphus/drafts/to-much-talker.md` — resolution order semantics
  - **External References**:
    - discord-hybrid-sharding IPC (used in Task 17 to provide the concrete `IpcTransport`): https://github.com/meister03/discord-hybrid-sharding#broadcasting

  **Acceptance Criteria**:
  - [ ] `resolveSettings(server: {max_chars:200}, channel: {max_chars:100}, user: {max_chars:150}, 'max_chars')` returns `100` (channel clamps user)
  - [ ] `resolveSettings(server: {allowed_models:['m1','m2']}, channel: {}, user: {preferred_model:'m3'}, 'preferred_model')` returns server's default (user not in allowlist)
  - [ ] `SettingsCache.get(...)` returns memoized value within TTL; `cache.invalidate(guildId)` evicts all entries for that guild
  - [ ] No throws in normal paths — all errors via Result

  **QA Scenarios**:

  ```
  Scenario: Clamping semantics produce correct min-of-three
    Tool: Bash (Vitest)
    Preconditions: Task 11 complete
    Steps:
      1. yarn workspace @to-much-talker/settings-core vitest run src/resolver.test.ts
    Expected Result: all assertions pass (8+ cases covering server/channel/user numeric combinations)
    Failure Indicators: any failed assertion
    Evidence: .sisyphus/evidence/task-11-clamp.log

  Scenario: Cache invalidation evicts only the target guild
    Tool: Bash (Vitest)
    Preconditions: Task 11 complete
    Steps:
      1. yarn workspace @to-much-talker/settings-core vitest run src/cache.test.ts
    Expected Result: assertion passes (guildA entries evicted, guildB entries remain)
    Failure Indicators: too-broad or too-narrow invalidation
    Evidence: .sisyphus/evidence/task-11-cache-invalidate.log
  ```

  **Evidence to Capture**:
  - [ ] `task-11-clamp.log`, `task-11-cache-invalidate.log`

  **Commit**: YES
  - Message: `feat(settings-core): add settings resolver, LRU cache, and IPC transport interface`
  - Files: `packages/settings-core/**`

- [x] 12. `apps/server` scaffolding — entrypoint, CLI parser, role auto-detect, logger

  **What to do**:
  - Create `apps/server/{package.json,tsconfig.json,README.md,AGENTS.md,src/{index.ts,cli.ts,logger.ts,bot/index.ts}}` (subdirs like `voice/`, `queue/`, `commands/`, `settings/` from Task 11 already, `setup/`, `i18n/` populated by later tasks)
  - Dependencies: `discord.js`, `discord-hybrid-sharding`, `@discordjs/voice`, `@discordjs/opus`, `prism-media`, `sodium-native` (with `libsodium-wrappers` fallback as optional), `pino`, `pino-pretty` (dev), `@to-much-talker/{shared,config,crypto,i18n,db,ai}`, `commander` (CLI), `zod`
  - `src/cli.ts`: uses `commander` with subcommands:
    - `start` (default) — `BOT_ROLE` env determines behavior
    - `key gen` — outputs base64 master key
    - `key rotate --new-key <b64>` — re-encrypts all rows (Task 18 implements)
    - `migrate` — runs migrations only
  - `src/index.ts`: thin entry, parses CLI then dispatches
  - `src/logger.ts`: pino instance configured per `LOG_LEVEL`; pretty in dev when `NODE_ENV !== 'production'`; redacts known sensitive fields (`apiKey`, `token`, `authorization`); child loggers per module via `logger.child({ component })`
  - `src/bot/index.ts`: placeholder `runBotWorker(config)` and `runClusterManager(config)` — filled by Tasks 13, 17
  - Role auto-detect: if `TOTAL_SHARDS > 1` AND `process.env.CLUSTER === undefined` (the manager) → run cluster manager; if `CLUSTER` is set (set by hybrid-sharding for spawned workers) → run worker
  - `apps/server/AGENTS.md`: comprehensive (entry order; module map: bot/voice/queue/commands/settings/setup/i18n; discord.js gotchas like never log tokens, never delete `interaction.token`, voice connection cleanup discipline; logger discipline)
  - `apps/server/README.md`: quickstart (env vars, key gen, run with docker run)
  - `package.json` scripts: `build` (tsc), `start` (`node --env-file=.env dist/index.js start`), `dev` (`node --import tsx --watch src/index.ts start`), `cli` (`node dist/index.js`)

  **Must NOT do**: never log tokens or API keys; never `process.exit` outside the top-level entry (use Result/throw and let entrypoint exit)

  **Recommended Agent Profile**:
  - **Category**: `quick` — wiring + scaffolding
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO with same-wave tasks (they all import this scaffold); but later wave-4 tasks (13, 14, 15, 16) depend on this so this should land FIRST in wave 4 — re-categorize: **Task 12 runs first within Wave 4**, then 13-16 in parallel
  - **Parallel Group**: Wave 4a (solo)
  - **Blocks**: 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
  - **Blocked By**: 2, 3

  **References**:
  - **Pattern References**: `packages/settings-core/**` (Task 11, already laid down)
  - **External References**:
    - discord.js setup: https://discord.js.org/docs/packages/discord.js/main/Client:Class
    - commander: https://github.com/tj/commander.js
    - pino: https://getpino.io/#/

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/server build` succeeds
  - [ ] `node dist/index.js --help` prints subcommands `start`, `key`, `migrate`
  - [ ] `LOG_LEVEL=debug NODE_ENV=development node --import tsx -e "import('./apps/server/src/logger.ts').then(m => { m.logger.debug({apiKey:'secret'}, 'should not appear'); m.logger.info({safe:'ok'}, 'should appear') })"` — `apiKey:'secret'` is redacted in output

  **QA Scenarios**:

  ```
  Scenario: CLI shows help with all subcommands
    Tool: Bash
    Preconditions: Task 12 complete
    Steps:
      1. yarn workspace @to-much-talker/server build
      2. node apps/server/dist/index.js --help
    Expected Result: stdout contains 'start', 'key', 'migrate'
    Failure Indicators: missing subcommands; non-zero exit
    Evidence: .sisyphus/evidence/task-12-cli-help.log

  Scenario: Logger redacts sensitive fields
    Tool: Bash
    Preconditions: Task 12 complete
    Steps:
      1. Run: LOG_LEVEL=debug NODE_ENV=development node --import tsx -e "import('./apps/server/src/logger.ts').then(m => { m.logger.info({apiKey:'sk-secret-xyz', userId:'u1'}, 'hi') })" 2>&1 | grep -c 'sk-secret-xyz'
    Expected Result: grep -c output is 0 (token not present in logs)
    Failure Indicators: count > 0
    Evidence: .sisyphus/evidence/task-12-logger-redact.log
  ```

  **Evidence to Capture**:
  - [ ] `task-12-cli-help.log`, `task-12-logger-redact.log`

  **Commit**: YES
  - Message: `feat(server): scaffold app entrypoint, CLI parser, logger, and AGENTS.md`
  - Files: `apps/server/{package.json,tsconfig.json,README.md,AGENTS.md,src/{index.ts,cli.ts,logger.ts,bot/index.ts}}`

- [x] 13. Discord client setup + slash command registry + Paraglide → Discord locale bridge

  **What to do**:
  - Create `apps/server/src/bot/{client.ts,commands-registry.ts,locale-bridge.ts}`
  - `client.ts`: `createClient(config): Client` — discord.js Client with proper intents (`GuildVoiceStates`, `GuildMessages`, `MessageContent`, `Guilds`); attach pino child logger via events
  - `commands-registry.ts`: `registerCommands(client, config)` — builds slash command tree using `SlashCommandBuilder` for `/tts` with subcommand groups; uses `locale-bridge` to attach localizations to every command + subcommand + option; called once at startup or on demand via CLI
  - `locale-bridge.ts`: `buildLocalizationsFor(messageKey)` — uses `@to-much-talker/i18n`'s `buildLocalizations` to produce Discord-format objects
  - Define COMMANDS as a typed array — each entry references the i18n message key; the registry iterates this array to build the Discord payload. Add unit test (Task 29) verifying every COMMANDS entry has a matching message key in i18n
  - Interaction router: `interactionCreate` listener dispatches to `commands/<name>/<sub>.ts` (created by tasks 19-23)
  - Error envelope: every interaction failure replies ephemerally with a localized error message + logs full error with `pino`

  **Must NOT do**: do NOT register commands per-guild (use global commands; faster for users; respects locale localizations); do NOT swallow errors silently

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 14, 15, 16
  - **Parallel Group**: Wave 4b
  - **Blocks**: 17, 19, 20, 21, 22, 23
  - **Blocked By**: 5, 12

  **References**:
  - **External References**:
    - discord.js SlashCommandBuilder: https://discord.js.org/docs/packages/builders/main/SlashCommandBuilder:Class
    - Discord interactions: https://discord.com/developers/docs/interactions/application-commands

  **Acceptance Criteria**:
  - [ ] `registerCommands` returns a valid Discord command payload (object passed to `client.application.commands.set`) that mocks accept
  - [ ] Every command has `name_localizations` populated for `ko` and `ja`
  - [ ] Mock client routes `interactionCreate` with `commandName='tts', subcommand='join'` to the `join` handler

  **QA Scenarios**:

  ```
  Scenario: Command payload has all expected localizations
    Tool: Bash (Vitest)
    Preconditions: Task 13 complete + Task 5 complete (i18n compiled)
    Steps:
      1. Build registry payload via registerCommands (using a mock client)
      2. Assert payload[0].name === 'tts'; payload[0].name_localizations has 'ko' and 'ja' keys
    Expected Result: assertion passes
    Failure Indicators: missing locales
    Evidence: .sisyphus/evidence/task-13-cmd-localizations.log

  Scenario: Interaction router dispatches to correct handler
    Tool: Bash (Vitest with mocked Discord)
    Preconditions: Task 13 complete + Task 6 (test-utils)
    Steps:
      1. Build mock ChatInputInteraction with commandName='tts', subcommand='join'
      2. Fire interactionCreate to the router with the mock
      3. Assert the registered handler for tts.join was called once
    Expected Result: handler called
    Failure Indicators: handler not called
    Evidence: .sisyphus/evidence/task-13-router.log
  ```

  **Evidence to Capture**:
  - [ ] `task-13-cmd-localizations.log`, `task-13-router.log`

  **Commit**: YES
  - Message: `feat(server): add discord.js client, slash command registry with i18n localization, and interaction router`
  - Files: `apps/server/src/bot/{client.ts,commands-registry.ts,locale-bridge.ts}`

- [x] 14. Voice pipeline — prism-media + FFmpeg + @discordjs/opus + abstract Player interface

  **What to do**:
  - Create `apps/server/src/voice/{index.ts,player.ts,pipeline.ts,connection.ts,resource.ts}`
  - `connection.ts`: `joinVoice(guild, channel): Promise<VoiceConnection>` wrapping `@discordjs/voice`'s `joinVoiceChannel`; reuse existing connection if already connected to same channel; handle the `Disconnected` state via `entersState` to gracefully recover from WS drops (per Metis edge case)
  - `pipeline.ts`: `audioBytesToOpus(input: Buffer, inputFormat: 'mp3'|'wav'|'pcm'|'opus'): Readable` — uses `prism-media.FFmpeg` to decode → 48kHz stereo PCM s16le → `@discordjs/opus.OpusEncoder` to encode → produces 20ms Opus frames as a Readable stream
  - `resource.ts`: `createAudioResourceFromBuffer(audio, format)` — wraps pipeline output as a `discord.js.voice.AudioResource`
  - `player.ts`: `class Player` per-guild
    - methods: `playFromBuffer(buf, format): Promise<void>`, `stop()`, `skip()`, `pause()`, `resume()`, `getState()`
    - emits events: `start`, `idle`, `error` — used by queue & idle modules
    - handles user moving voice channel mid-playback: listen to `voiceStateUpdate`; if the BOT is moved → reattach; if all humans leave triggers idle leave (Task 16)
  - Voice region: respect Discord's selection (guild voice region); no override needed
  - Hard timeout: TTS audio playback bounded by track duration + 10s grace

  **Must NOT do**: NO global FFmpeg processes; each pipeline call gets its own short-lived FFmpeg process and is killed on completion or error; NO writing audio to disk (in-memory only)

  **Recommended Agent Profile**:
  - **Category**: `deep` — audio + lifecycle correctness matters
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 13, 15, 16
  - **Parallel Group**: Wave 4b
  - **Blocks**: 17
  - **Blocked By**: 11, 12

  **References**:
  - **External References**:
    - @discordjs/voice intro: https://discord.js.org/docs/packages/voice/main
    - prism-media FFmpeg: https://github.com/discord-player/prism-media
    - Audio resource: https://discord.js.org/docs/packages/voice/main/createAudioResource:function

  **Acceptance Criteria**:
  - [ ] Calling `audioBytesToOpus(<mp3-bytes>, 'mp3')` produces a stream that yields Opus frames; count is approximately `ceil(duration_ms / 20)`
  - [ ] FFmpeg subprocess terminates after pipeline completes (no zombie processes)
  - [ ] `Player.playFromBuffer` resolves after audio plays through (in test, mocked AudioPlayer)
  - [ ] Voice disconnect → `entersState` reattaches within 5s in test scenario

  **QA Scenarios**:

  ```
  Scenario: MP3 buffer is transcoded to Opus frames
    Tool: Bash
    Preconditions: Task 14 complete + FFmpeg installed locally
    Steps:
      1. Generate a 1-second silent MP3 to /tmp/silent.mp3 via `ffmpeg -f lavfi -i anullsrc -t 1 -c:a libmp3lame /tmp/silent.mp3`
      2. Run: node --import tsx -e "import('fs').then(fs => import('./apps/server/src/voice/pipeline.ts').then(async m => { const buf = fs.readFileSync('/tmp/silent.mp3'); const stream = m.audioBytesToOpus(buf, 'mp3'); let frames = 0; for await (const c of stream) { if (c.length>0) frames++ } console.log(`frames=${frames}`); if (frames < 30 || frames > 60) process.exit(2) })"
    Expected Result: stdout shows frames=~50 (1s of 20ms frames); exit 0
    Failure Indicators: 0 frames; way-off count
    Evidence: .sisyphus/evidence/task-14-opus-frames.log

  Scenario: FFmpeg subprocess cleans up
    Tool: Bash
    Preconditions: Task 14 complete
    Steps:
      1. Before: pgrep -c ffmpeg (record baseline)
      2. Run a Player playback; await completion
      3. After: pgrep -c ffmpeg
    Expected Result: post count == pre count (no leaks)
    Failure Indicators: count grew
    Evidence: .sisyphus/evidence/task-14-ffmpeg-cleanup.log
  ```

  **Evidence to Capture**:
  - [ ] `task-14-opus-frames.log`, `task-14-ffmpeg-cleanup.log`

  **Commit**: YES
  - Message: `feat(server): add voice pipeline (FFmpeg + Opus) and Player lifecycle with WS reattach`
  - Files: `apps/server/src/voice/**`

- [x] 15. Queue strategy interface + 3 built-in implementations (drop-oldest, drop-newest, interrupt)

  **What to do**:
  - Create `apps/server/src/queue/{index.ts,types.ts,strategies/{drop-oldest.ts,drop-newest.ts,interrupt.ts},registry.ts,manager.ts}`
  - `types.ts`: `interface QueueStrategy<T = QueuedItem> { name: string; enqueue(item: T, q: T[]): { accepted: boolean; evicted: T[] }; }`; `interface QueuedItem { id: string; text: string; userId: UserId; channelId: ChannelId; addedAt: number; estCostMicros: number }`
  - `strategies/drop-oldest.ts`: when `q.length >= cap`, shift the oldest and push the new one (accepted = true, evicted = [the shifted item])
  - `strategies/drop-newest.ts`: when `q.length >= cap`, reject the new (accepted = false, evicted = []); else push
  - `strategies/interrupt.ts`: clears the queue and the playing item (accepted = true, evicted = [all previous items]); manager handles "stop player" signal
  - `registry.ts`: maps strategy name → instance; `getStrategy(name): QueueStrategy`; allows future custom strategies (kept open per user's "abstract queue, configurable per channel")
  - `manager.ts`: `class GuildQueueManager` keyed by `guildId`; each guild has Map<channelId, channelQueue>; channelQueue carries strategy + cap from settings; exposes `enqueue`, `next`, `clear`, `skip`, `peek`
  - Channel queue listens to `Player.idle` event and pulls next item

  **Must NOT do**: do NOT make strategy choice global — every channel has its own; do NOT block; queues are in-memory only (state is local per cluster per Round 6)

  **Recommended Agent Profile**:
  - **Category**: `deep` — strategy pattern + correctness across edge cases
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 13, 14, 16
  - **Parallel Group**: Wave 4b
  - **Blocks**: 17
  - **Blocked By**: 2, 11

  **References**:
  - **Pattern References**: Round 3 draft entry for queue behavior

  **Acceptance Criteria**:
  - [ ] All 3 strategies pass property tests: total queue size never exceeds cap; eviction counts match strategy semantics
  - [ ] `getStrategy('drop-oldest')` returns a working strategy; `getStrategy('unknown')` returns Result.err / throws a documented error
  - [ ] `interrupt` strategy clears current playback (verified via Player mock receiving `stop` call)

  **QA Scenarios**:

  ```
  Scenario: drop-oldest never exceeds cap
    Tool: Bash (Vitest)
    Preconditions: Task 15 complete
    Steps:
      1. Enqueue 100 items with cap=10 using drop-oldest
      2. Assert final queue length === 10; ids are the LAST 10
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-15-drop-oldest.log

  Scenario: interrupt clears current playback and queue
    Tool: Bash (Vitest)
    Preconditions: Task 15 complete + Player mock
    Steps:
      1. Player is playing item A; queue contains B, C
      2. Enqueue D with strategy 'interrupt'
      3. Assert: player.stop was called; queue contains only D
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-15-interrupt.log
  ```

  **Evidence to Capture**:
  - [ ] `task-15-drop-oldest.log`, `task-15-interrupt.log`

  **Commit**: YES
  - Message: `feat(server): add pluggable queue strategy interface and three built-in strategies`
  - Files: `apps/server/src/queue/**`

- [x] 16. Idle behavior — text-inactivity timer + voice-empty detector + combined leave

  **What to do**:
  - Create `apps/server/src/voice/idle.ts`
  - `class IdleWatcher` per channel-binding (guild, voice-channel-id, bound-text-channel-id):
    - reset text inactivity timer on each TTS message played; default 5min from settings (`IDLE_TEXT_INACTIVITY_MS`)
    - listen to `voiceStateUpdate` events: if member count drops to 0 humans (bot doesn't count) → trigger leave
    - on EITHER trigger fires → call `leaveVoice(connection)` + cleanup queue + emit `idle-leave` event for logging
  - Watcher started by `/tts join` handler (Task 19); stopped by `/tts leave` handler
  - Edge case: if bot is moved between voice channels (admin drag), reattach to new channel (per Metis edge case)
  - Edge case: if all humans leave THEN someone comes back within a grace window (5s, configurable), cancel pending leave

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 13, 14, 15
  - **Parallel Group**: Wave 4b
  - **Blocks**: 17
  - **Blocked By**: 11, 14

  **References**:
  - **Pattern References**: Round 3 draft entry (Combination idle behavior)

  **Acceptance Criteria**:
  - [ ] After `IDLE_TEXT_INACTIVITY_MS` with no `played` events, watcher emits `idle-leave`
  - [ ] When all humans leave the voice channel + grace expires, watcher emits `idle-leave`
  - [ ] When humans return within grace, leave is canceled
  - [ ] Bot move between VCs is handled (watcher reattaches to new channel)

  **QA Scenarios**:

  ```
  Scenario: Text inactivity triggers leave
    Tool: Bash (Vitest fake timers)
    Preconditions: Task 16 complete
    Steps:
      1. Mount IdleWatcher with timeout=1000ms; emit 'play' at t=0
      2. Advance fake time by 1500ms
      3. Assert idle-leave event fired exactly once
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-16-text-inactivity.log

  Scenario: Humans returning in grace window cancels leave
    Tool: Bash (Vitest)
    Preconditions: Task 16 complete
    Steps:
      1. Mount watcher; trigger voice empty → leave scheduled at +5000ms
      2. At +3000ms, fire voiceStateUpdate with human joining
      3. Advance to +6000ms
      4. Assert idle-leave NOT fired
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-16-grace-cancel.log
  ```

  **Evidence to Capture**:
  - [ ] `task-16-text-inactivity.log`, `task-16-grace-cancel.log`

  **Commit**: YES
  - Message: `feat(server): add IdleWatcher with text inactivity, voice-empty detection, and grace cancellation`
  - Files: `apps/server/src/voice/idle.ts`

- [x] 17. Cluster manager + worker — discord-hybrid-sharding integration

  **What to do**:
  - Create `apps/server/src/cluster/{manager.ts,worker.ts,ipc.ts}`
  - `manager.ts`: `runClusterManager(config)` uses `ClusterManager` from `discord-hybrid-sharding`; spawns workers (`apps/server/dist/index.js`); auto-detects total shards via `fetchRecommendedShardCount` from discord.js gateway endpoint (with `TOTAL_SHARDS` env override); spreads shards across `CLUSTER_COUNT` clusters
  - `worker.ts`: `runBotWorker(config)` — creates discord.js Client (Task 13), registers commands, attaches all listeners (voice, queue, idle, settings-IPC via the concrete `HybridShardingIpcTransport` plugged into `@to-much-talker/settings-core`, interactions). **Workers do NOT run migrations.** Workers verify schema version on startup (call a `checkSchema(db)` helper from `packages/db`); if schema is out of date, exit with a clear error
  - `ipc.ts`: defines the typed IPC envelope between manager and worker: `type IpcMessage = { type: 'settings:invalidate'; payload: { guildId, scope } } | { type: 'reload' } | ...`; helpers to send/receive with validation; also provides the concrete `HybridShardingIpcTransport` class implementing the `IpcTransport` interface from `@to-much-talker/settings-core`
  - **Migration coordination (single rule)**: the **cluster manager** runs migrations EXACTLY ONCE, BEFORE spawning workers. The standalone `migrate` CLI subcommand (Task 12) is for manual ops use and does the same work without spawning workers. Workers themselves NEVER run migrations.
  - Graceful shutdown: SIGTERM → manager broadcasts shutdown → workers stop accepting new interactions → drain queues → close voice connections → exit; total budget 30s

  **Must NOT do**: do NOT have workers run migrations (concurrency race); do NOT swallow worker crashes silently (use `cluster.on('death')` + structured log + bounded restart)

  **Recommended Agent Profile**:
  - **Category**: `deep` — concurrency + lifecycle
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: NO with same-wave (depends on most of Wave 4)
  - **Parallel Group**: Wave 5a (solo)
  - **Blocks**: F1
  - **Blocked By**: 8, 9, 13, 14, 15, 16

  **References**:
  - **External References**:
    - discord-hybrid-sharding: https://github.com/meister03/discord-hybrid-sharding
    - discord.js fetchRecommendedShardCount: https://discord.js.org/docs/packages/discord.js/main/util:fetchRecommendedShardCount

  **Acceptance Criteria**:
  - [ ] `TOTAL_SHARDS=2 CLUSTER_COUNT=1 node dist/index.js start` (with mocked Discord) spawns 1 child worker process serving 2 shards
  - [ ] Migrations run once before workers spawn (no duplicate concurrent migrations)
  - [ ] SIGTERM to manager initiates graceful shutdown; voice connections destroyed; process exits within 35s
  - [ ] Settings IPC: `manager.broadcast({type:'settings:invalidate', payload:{guildId:'g1', scope:'server'}})` reaches all workers; each worker's SettingsCache evicts entries for `g1`

  **QA Scenarios**:

  ```
  Scenario: Cluster manager spawns workers and runs migrations once
    Tool: Bash
    Preconditions: Task 17 complete; mocked Discord (no real connect)
    Steps:
      1. Set env DISCORD_TOKEN=fake DISCORD_CLIENT_ID=000000000000000000 TOTAL_SHARDS=2 CLUSTER_COUNT=1 MOCK_DISCORD=1
      2. Run: node apps/server/dist/index.js start &
      3. Wait 5s; ps -ef | grep 'apps/server/dist/index.js' | wc -l
      4. Kill manager (SIGTERM); confirm cleanup
    Expected Result: 2 processes (manager + 1 worker); migrations log shows "applied 1 migration" exactly once
    Failure Indicators: 0 or 3+ processes; migration applied twice
    Evidence: .sisyphus/evidence/task-17-cluster-spawn.log

  Scenario: Settings invalidation propagates manager → workers
    Tool: Bash
    Preconditions: Task 17 complete + Task 11 cache
    Steps:
      1. Run with manager + 1 worker
      2. Trigger manager.broadcast settings:invalidate for guildId='g1'
      3. Worker logs show "SettingsCache evicted entries for g1"
    Expected Result: log line present
    Failure Indicators: no log; broadcast errored
    Evidence: .sisyphus/evidence/task-17-ipc-invalidate.log
  ```

  **Evidence to Capture**:
  - [ ] `task-17-cluster-spawn.log`, `task-17-ipc-invalidate.log`

  **Commit**: YES
  - Message: `feat(server): add cluster manager and worker via discord-hybrid-sharding with IPC and migration coordination`
  - Files: `apps/server/src/cluster/**, apps/server/src/index.ts (wiring)`

- [x] 18. CLI `key gen` + `key rotate` subcommands

  **What to do**:
  - Wire `key gen` subcommand to call `@to-much-talker/crypto.generateMasterKey()` and print base64
  - Wire `key rotate` subcommand: requires `--new-key <b64>`; flow:
    1. Open DB
    2. Parse both old (env `MASTER_ENC_KEY`) and new (CLI arg) keys
    3. For each row in `guild_settings` with `api_key_encrypted IS NOT NULL`: decrypt with KeyRing (current version) → re-encrypt with new key → write back with bumped `api_key_version`
    4. Print summary: `Rotated N keys; old key still required to decrypt N legacy rows older than now`
  - Subcommand uses `--dry-run` flag to log without writing
  - Update `apps/server/AGENTS.md`: rotation procedure documented inline

  **Must NOT do**: never print key material in `--dry-run`; never accept keys via env in addition to CLI for `rotate` (avoid ambiguity)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 19-23
  - **Parallel Group**: Wave 5b
  - **Blocks**: F1
  - **Blocked By**: 4, 12

  **References**:
  - **Pattern References**: Round 12 draft entry (Master encryption key)

  **Acceptance Criteria**:
  - [ ] `node dist/index.js key gen` prints a 44-character base64 string
  - [ ] `key rotate --new-key <valid>` with seeded encrypted rows: rows re-encrypted, `key_version` bumped, decryption with new key succeeds, with old key fails
  - [ ] `key rotate --dry-run` reports count without writing

  **QA Scenarios**:

  ```
  Scenario: key gen output is valid base64 of 32 bytes
    Tool: Bash
    Preconditions: Task 18 complete
    Steps:
      1. Run: K=$(node apps/server/dist/index.js key gen); echo -n "$K" | base64 -d | wc -c
    Expected Result: 32
    Failure Indicators: != 32; not base64
    Evidence: .sisyphus/evidence/task-18-keygen.log

  Scenario: key rotate re-encrypts and bumps version
    Tool: Bash
    Preconditions: Task 18 complete + seeded DB
    Steps:
      1. Seed in-memory DB with a guild_settings row encrypted under key K1
      2. Run: MASTER_ENC_KEY=$K1 node dist/index.js key rotate --new-key $K2
      3. Query: api_key_version should now be 2; decrypting with K2 returns original plaintext
    Expected Result: version=2; decryption matches
    Evidence: .sisyphus/evidence/task-18-rotate.log
  ```

  **Evidence to Capture**:
  - [ ] `task-18-keygen.log`, `task-18-rotate.log`

  **Commit**: YES
  - Message: `feat(server): add CLI key gen and key rotate subcommands with versioning`
  - Files: `apps/server/src/cli.ts, apps/server/src/cluster/manager.ts (migration wiring update), apps/server/AGENTS.md`

- [x] 19. Slash commands — /tts join, /tts leave, /tts skip, /tts clear

  **What to do**:
  - Create `apps/server/src/commands/tts/{join.ts,leave.ts,skip.ts,clear.ts}`
  - Each handler signature: `async function handle(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>` (ctx provides db, logger, settings, voice manager, queue manager, i18n)
  - `join.ts`: voice-channel-must-be-visible permission check; ensure user is in a voice channel; require an option `text-channel?: ChannelOption` (defaults to invocation channel for text); validate the bound text channel is a real text channel in same guild; create/reuse VoiceConnection (Task 14); start IdleWatcher (Task 16); reply ephemerally with localized success message
  - `leave.ts`: if connected, destroy connection, clear queue, stop IdleWatcher, reply localized
  - `skip.ts`: if playing, stop current track → next() pulls from queue
  - `clear.ts`: clear queue (does not stop currently-playing track unless `force:true` option)
  - All commands write to `setting_audit_log` if they affect a setting (clear doesn't; join/leave does change bound-channel)
  - Localize all replies via i18n; respect user's preferred locale (from user_settings, fallback to Discord client locale, fallback to 'en')
  - Edge cases handled (Metis surface): user has no voice channel → friendly error; another voice connection elsewhere in guild → ask to leave first; permission to join VC denied → localized error

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 18, 20, 21, 22, 23
  - **Parallel Group**: Wave 5b
  - **Blocks**: F1
  - **Blocked By**: 11, 13

  **References**:
  - **External References**:
    - discord.js voice docs: https://discordjs.guide/voice/
    - Slash command best practices: https://discordjs.guide/slash-commands/

  **Acceptance Criteria**:
  - [ ] `/tts join` with caller in voice channel → bot joins, replies in user's locale
  - [ ] `/tts join` with caller NOT in voice channel → ephemeral error
  - [ ] `/tts leave` while connected → bot leaves, queue cleared
  - [ ] `/tts skip` interrupts current playback; next item plays
  - [ ] `/tts clear` empties queue

  **QA Scenarios**:

  ```
  Scenario: /tts join happy path
    Tool: Bash (Vitest with mocked Discord)
    Preconditions: Task 19 complete
    Steps:
      1. Build mockChatInputInteraction({commandName:'tts', subcommand:'join', user:{voiceState:{channelId:'vc1'}}})
      2. Invoke join handler
      3. Assert: VoiceManager.join called with channelId='vc1'; interaction.reply called with localized success
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-19-join-happy.log

  Scenario: /tts join with user not in VC
    Tool: Bash (Vitest)
    Preconditions: Task 19 complete
    Steps:
      1. Build mock interaction with no voice state
      2. Invoke join handler
      3. Assert: VoiceManager.join NOT called; interaction.reply called with localized error
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-19-join-no-vc.log
  ```

  **Evidence to Capture**:
  - [ ] `task-19-join-happy.log`, `task-19-join-no-vc.log`

  **Commit**: YES
  - Message: `feat(server): add /tts join, leave, skip, clear slash commands`
  - Files: `apps/server/src/commands/tts/{join,leave,skip,clear}.ts`

- [x] 20. Slash commands — /tts say (one-off), /tts stats, /tts help

  **What to do**:
  - Create `apps/server/src/commands/tts/{say.ts,stats.ts,help.ts}`
  - `say.ts`: required `text` option (max 2000 chars); requires bot to already be in a voice channel; sanitize text:
    - **Mentions**: replace `<@123>` with the user's display name (resolved via cache); `<@&456>` with role name; `<#789>` with channel name (Metis edge case)
    - **Custom emoji** `<:name:123>`: speak the name `:name:` (Metis edge case)
    - **URLs**: replaced with "link" (Metis edge case) or stripped — configurable per-channel setting `say_link_policy` (default: replace)
    - **Code blocks**: configurable — skip / speak literally / read aloud as "code block follows" (default: skip multiline code blocks, read single-line backticks)
    - **Attachments/embeds**: not applicable to slash command text input; for read-all-messages mode (join+bound) → describe the attachment ("image attached")
  - **Long-message chunking** (Metis edge case): if final sanitized text > `max_chars` → if `chunking_enabled` (settings, default true) split at sentence boundaries with overlap, enqueue each chunk as a separate queue item with original message metadata; if disabled → reject with localized error
  - Pre-flight cost (Task 23 logic): refuse if estimated cost > server `max_price_cents` or > user/channel chars cap
  - Enqueue via queue manager; reply with queue position (localized)
  - `stats.ts`: show current queue + last 24h: count of TTS calls, total chars, est cost; admin-only sees server-wide stats
  - `help.ts`: localized help text linking to docs site

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 18, 19, 21, 22, 23
  - **Parallel Group**: Wave 5b
  - **Blocks**: F1
  - **Blocked By**: 11, 13

  **References**:
  - **Pattern References**: Round 3 + Metis edge cases
  - **External References**:
    - discord.js MessageMentions: https://discord.js.org/docs/packages/discord.js/main/MessageMentions:Class

  **Acceptance Criteria**:
  - [ ] `/tts say text:"hi @user"` produces a queue item with text "hi <DisplayName>"
  - [ ] `/tts say text:<10000-char-blob>` chunks into multiple queue items (each ≤ max_chars) when chunking enabled
  - [ ] `/tts say` with empty bot voice connection → ephemeral error
  - [ ] `/tts stats` returns localized stats; admin sees server-wide
  - [ ] `/tts help` returns localized help with docs URL

  **QA Scenarios**:

  ```
  Scenario: Mentions are resolved to display names
    Tool: Bash (Vitest)
    Preconditions: Task 20 complete
    Steps:
      1. Mock interaction with text 'hello <@123>'; mock guild member id=123 display='Alice'
      2. Invoke say handler; capture enqueued item text
    Expected Result: enqueued text is 'hello Alice'
    Evidence: .sisyphus/evidence/task-20-mention-resolve.log

  Scenario: Long message chunking respects max_chars
    Tool: Bash (Vitest)
    Preconditions: Task 20 complete; max_chars=100
    Steps:
      1. Submit say with 1000-char text
      2. Inspect enqueued items: each text length <= 100
    Expected Result: all chunks within bound; total chars approximately preserved
    Evidence: .sisyphus/evidence/task-20-chunking.log
  ```

  **Evidence to Capture**:
  - [ ] `task-20-mention-resolve.log`, `task-20-chunking.log`

  **Commit**: YES
  - Message: `feat(server): add /tts say with sanitization and chunking, plus /tts stats and /tts help`
  - Files: `apps/server/src/commands/tts/{say,stats,help}.ts, apps/server/src/text-sanitize/**`

- [x] 21. Slash commands — /tts settings (server, channel, user) get/set/reset + audit

  **What to do**:
  - Create `apps/server/src/commands/tts/settings/{server.ts,channel.ts,user.ts,audit.ts}`
  - Subcommand groups under `/tts settings`:
    - `/tts settings server get|set|reset` — Administrator permission required (or `permissions_role_id`)
    - `/tts settings channel get|set|reset` — ManageChannels permission required (or delegated role)
    - `/tts settings user get|set|reset` — anyone, for their own scope
    - `/tts settings audit` — Administrator only; shows last N changes for the guild
  - Each `set` validates with zod (per-setting schemas) → writes to DB → writes `setting_audit_log` row → broadcasts settings:invalidate via IPC → replies with localized confirmation
  - Each `reset` clears the value (sets to null / default) → audit row → invalidate
  - Allowed-models setting: validates each model ID by calling `validateModel` (Task 10); accepts only IDs that exist on OpenRouter AND are in the bot-wide ceiling list (env `BOT_ALLOWED_MODELS_CEILING`, default the two user-supplied IDs)
  - Settings list (settings keys): `api_key` (server, write-only via DM flow Task 23 — not via this command), `allowed_models`, `default_model`, `default_voice`, `max_chars`, `max_price_cents`, `idle_text_inactivity_ms`, `idle_leave_on_empty`, `permissions_role_id`, `locale`; channel: `max_chars`, `max_queue_size`, `queue_strategy`, `queue_strategy_params`, `bound_text_channel_id`; user: `preferred_model`, `preferred_voice`, `preferred_locale`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 18, 19, 20, 22, 23
  - **Parallel Group**: Wave 5b
  - **Blocks**: F1
  - **Blocked By**: 11, 13

  **References**:
  - **Pattern References**: Round 7 draft entry (settings semantics)

  **Acceptance Criteria**:
  - [ ] `/tts settings server set max_chars:200` writes row, audit row, invalidates cache → 5 DB calls
  - [ ] Permission denied for non-admin → ephemeral localized error; no DB write
  - [ ] `/tts settings server set allowed_models:'fake/model'` rejected (not on OpenRouter); valid IDs accepted
  - [ ] `/tts settings audit` returns last N entries formatted with localized text

  **QA Scenarios**:

  ```
  Scenario: Settings write produces audit row + cache invalidation
    Tool: Bash (Vitest + ephemeral SQLite)
    Preconditions: Task 21 complete
    Steps:
      1. Seed admin user; call /tts settings server set max_chars:300
      2. Query DB: guild_settings.max_chars === 300; setting_audit_log has 1 row with old_value=<prior>, new_value=300
      3. Assert: cache.invalidate was called for guildId
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-21-set-audit-invalidate.log

  Scenario: Non-admin denied
    Tool: Bash (Vitest)
    Preconditions: Task 21 complete
    Steps:
      1. Mock interaction with user who lacks Administrator perm
      2. Invoke /tts settings server set
      3. Assert: no DB write; ephemeral localized error
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-21-non-admin-denied.log
  ```

  **Evidence to Capture**:
  - [ ] `task-21-set-audit-invalidate.log`, `task-21-non-admin-denied.log`

  **Commit**: YES
  - Message: `feat(server): add /tts settings server/channel/user get/set/reset with audit log and validation`
  - Files: `apps/server/src/commands/tts/settings/**`

- [x] 22. /tts setup wizard + first-run owner DM

  **What to do**:
  - Create `apps/server/src/setup/{wizard.ts,welcome.ts}`
  - `welcome.ts`: `guildCreate` event handler — DM the server owner with localized welcome message + link to `/tts setup` wizard + docs URL; if owner DMs are closed, fall back to posting in system channel (only if bot has SendMessages perm there); never spam — track in DB whether welcome was already sent for this guild
  - `wizard.ts`: implemented as a slash command `/tts setup` (subcommand under `/tts`); guides admin through:
    1. "Set your OpenRouter API key" → instructs the user to DM the bot with `/tts settings set api-key` (which opens a modal — Task 23)
    2. "Pick allowed models" → presents Discord SelectMenu with the bot-wide ceiling list; admin multi-selects → writes via Task 21 logic
    3. "Default voice + model" → text input
    4. "Locale" → SelectMenu of `en/ko/ja`
  - State stored ephemerally in the interaction context (Discord interactions allow updating); each step uses `interaction.update` to continue the wizard

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 18, 19, 20, 21, 23
  - **Parallel Group**: Wave 5b
  - **Blocks**: F1
  - **Blocked By**: 11, 13

  **References**:
  - **External References**:
    - Discord SelectMenu: https://discord.com/developers/docs/interactions/message-components#select-menus
    - guildCreate event: https://discord.js.org/docs/packages/discord.js/main/Client:Class#guildCreate

  **Acceptance Criteria**:
  - [ ] On `guildCreate`: owner is DM'd with localized welcome (verified via mocked client)
  - [ ] Duplicate `guildCreate` for same guild → no second DM
  - [ ] Wizard step transitions correctly; final step writes settings + audit + invalidates cache

  **QA Scenarios**:

  ```
  Scenario: guildCreate sends owner DM exactly once
    Tool: Bash (Vitest)
    Preconditions: Task 22 complete
    Steps:
      1. Fire guildCreate event for guild g1 (owner=user1) twice
      2. Assert: user1.send was called exactly once; welcome_sent flag in DB true
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-22-welcome-once.log

  Scenario: Wizard step 4 writes settings
    Tool: Bash (Vitest)
    Preconditions: Task 22 complete
    Steps:
      1. Simulate user completing all 4 wizard steps
      2. Verify guild_settings updated with new locale, allowed_models, default_model, default_voice
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-22-wizard-complete.log
  ```

  **Evidence to Capture**:
  - [ ] `task-22-welcome-once.log`, `task-22-wizard-complete.log`

  **Commit**: YES
  - Message: `feat(server): add /tts setup wizard and first-run owner DM`
  - Files: `apps/server/src/setup/**`

- [x] 23. API key entry via DM modal + OpenRouter validation + pre-flight cost + post-call accounting

  **What to do**:
  - Three related but distinct features in one task (all touch `apps/server/src/commands/tts/settings/api-key.ts` + cost-pipeline helpers):

  **(a) API key entry DM modal flow**:
  - `/tts settings set api-key` (server scope) — Administrator perm required; replies ephemerally: "Check your DMs"; sends DM with a button "Open key entry"; clicking the button shows a Discord modal (text input, hidden type)
  - On modal submit: receive plaintext key; validate format (basic regex starts with `sk-or-`); call `OpenRouterClient(testClient).validateModel('google/gemini-3.1-flash-tts-preview')` as a connectivity + auth check (small request, low cost)
  - On success: encrypt with current master key (Task 4), write to `guild_settings` (`api_key_encrypted/iv/auth_tag/version`), audit log, IPC invalidate; reply DM "Saved"
  - On failure (invalid key / 401 from OpenRouter): reply DM with friendly error; do NOT write

  **(b) Pre-flight cost estimation** (used by Task 20 `/tts say` and read-all-mode):
  - Helper `estimateCost({model, text, channelSettings, serverSettings}): Result<{micros: number, accepted: boolean, reason?: string}>`
  - Looks up model pricing (cached for 1h from `/models` endpoint)
  - char × per-char rate
  - Compares to `max_chars` (cap on text), `max_price_cents * 10000` (convert to micros) bounded by clamped settings
  - Returns accepted/rejected with reason; caller emits localized error if rejected

  **(c) Post-call accounting**:
  - In TTS playback path (Task 14), after `synthesize` returns: parse `usage` headers/body if present (e.g. `OpenRouter-Provider-Cost`)
  - Write `tts_message_log` row: model, char_count, est_cost_micros, actual_cost_micros (from response), played_at
  - Background daily aggregation job (cron-like via `setInterval`, 24h period): roll up cumulative spend per guild for `/tts stats`

  **Recommended Agent Profile**:
  - **Category**: `deep` — multi-feature with security + cost correctness
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 18-22
  - **Parallel Group**: Wave 5b
  - **Blocks**: F1
  - **Blocked By**: 10, 11

  **References**:
  - **Pattern References**: Round 4 draft entry; Metis A2 (OpenRouter endpoint)
  - **External References**:
    - Discord modal: https://discord.com/developers/docs/interactions/message-components#text-inputs
    - OpenRouter pricing: https://openrouter.ai/docs/api-reference/list-available-models

  **Acceptance Criteria**:
  - [ ] Modal flow: `/tts settings set api-key` → DM → click button → modal opens → submit valid key → DB row encrypted with `api_key_version=current` → "Saved" DM
  - [ ] Invalid key: 401 from OpenRouter → no DB write; user-friendly error DM
  - [ ] `estimateCost` rejects oversized text with reason='exceeds max_chars'
  - [ ] After `synthesize`: `tts_message_log` row exists with both `est_cost_micros` and `actual_cost_micros`

  **QA Scenarios**:

  ```
  Scenario: Valid key persists encrypted; invalid key rejected
    Tool: Bash (Vitest with mocked OpenRouter)
    Preconditions: Task 23 complete
    Steps:
      1. Mock OpenRouter /models 200 OK for key 'good'; 401 for key 'bad'
      2. Simulate modal submission with 'good' → assert guild_settings.api_key_encrypted not null; decrypting returns 'good'
      3. Simulate modal submission with 'bad' → assert DB unchanged; error DM sent
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-23-modal-keyflow.log

  Scenario: Pre-flight cost rejects oversized text
    Tool: Bash (Vitest)
    Preconditions: Task 23 complete
    Steps:
      1. Resolved settings: max_chars=100
      2. Call estimateCost({text:'a'.repeat(200), ...})
      3. Assert result.accepted === false; reason mentions max_chars
    Expected Result: passes
    Evidence: .sisyphus/evidence/task-23-cost-reject.log
  ```

  **Evidence to Capture**:
  - [ ] `task-23-modal-keyflow.log`, `task-23-cost-reject.log`

  **Commit**: YES
  - Message: `feat(server): add API key DM modal flow, pre-flight cost estimation, and post-call accounting`
  - Files: `apps/server/src/commands/tts/settings/api-key.ts, apps/server/src/cost/{estimate.ts,account.ts}`

- [x] 24. `apps/playground` scaffolding — TanStack Start + Tailwind v4 + Shadcn + i18n + localhost bind

  **What to do**:
  - Create `apps/playground/{package.json,tsconfig.json,vite.config.ts,app.config.ts (TanStack Start),tailwind.config.css,components.json (Shadcn),src/{app/router.tsx,app/__root.tsx,app/index.tsx,lib/{api.ts,i18n.ts},components/ui/}, AGENTS.md, README.md}`
  - Dependencies: `@tanstack/start`, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-form`, `@tanstack/pacer`, `react`, `react-dom`, `tailwindcss@4`, `@tailwindcss/vite`, Shadcn dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/*`), `@to-much-talker/{shared,config,db,ai,i18n}`, `zod`
  - Initialize Shadcn New York style: include `components.json` configured for `style: 'new-york'`, `tsx: true`, `tailwind.config: 'tailwind.config.css'`
  - Tailwind v4 CSS-first: `tailwind.config.css` with `@theme` block including Shadcn tokens (color/radius/etc.) for New York style; main CSS at `src/styles/globals.css`
  - Dark mode default via `class` strategy + `<html class="dark">` + a toggle component
  - Localhost-only bind: vite config reads `process.env.PLAYGROUND_HOST` (default `'127.0.0.1'`). If `PLAYGROUND_HOST` is `'0.0.0.0'` AND `PLAYGROUND_ALLOW_ALL !== '1'` AND `NODE_ENV !== 'docker'`, refuse to start with a friendly error pointing to the Docker entry path. Inside the Docker image (Task 34), `NODE_ENV=docker` + `PLAYGROUND_HOST=0.0.0.0` is set so the in-container server listens on all interfaces — but the WARNING banner reminds operators that the container must not be exposed publicly. Outside Docker, the dev server stays on loopback unless `PLAYGROUND_ALLOW_ALL=1` is explicitly set.
  - Connect to bot DB read-only by default: `lib/api.ts` uses `@to-much-talker/db.openDb(DATABASE_URL)` server-side via TanStack Start server functions; writes throw unless `PLAYGROUND_WRITE_ENABLED=1`
  - i18n: import `@to-much-talker/i18n` Paraglide compiled output; locale picker in header
  - AGENTS.md: localhost-only constraint MUST be preserved; never expose write endpoints publicly; this app is DEV-ONLY — explicitly noted; no production analytics/tracking

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 27 (different app)
  - **Parallel Group**: Wave 6a
  - **Blocks**: 25, 26
  - **Blocked By**: 5

  **References**:
  - **External References**:
    - TanStack Start: https://tanstack.com/start/v0/docs/framework/react/quick-start
    - TanStack Start markdown ref (for our docs site): https://tanstack.com/start/v0/docs/framework/react/guide/rendering-markdown.md
    - Tailwind v4 CSS-first: https://tailwindcss.com/blog/tailwindcss-v4
    - Shadcn New York: https://ui.shadcn.com/docs/installation

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/playground dev` (no env set) starts on 127.0.0.1:5173 by default
  - [ ] `yarn workspace @to-much-talker/playground build` produces a production build
  - [ ] `PLAYGROUND_HOST=0.0.0.0 yarn ... dev` (without `PLAYGROUND_ALLOW_ALL=1` and without `NODE_ENV=docker`) **refuses to start** with a friendly error explaining the policy
  - [ ] `PLAYGROUND_HOST=0.0.0.0 PLAYGROUND_ALLOW_ALL=1 yarn ... dev` listens on 0.0.0.0 with a clear WARNING banner in the log

  **QA Scenarios**:

  ```
  Scenario: Default dev server binds only to localhost
    Tool: interactive_bash (tmux)
    Preconditions: Task 24 complete
    Steps:
      1. tmux send-keys "yarn workspace @to-much-talker/playground dev" Enter
      2. After 5s, in another shell: `curl -sf http://127.0.0.1:5173/ -o /dev/null && echo LOCAL_OK || echo LOCAL_FAIL`
      3. tmux send-keys C-c Enter (kill dev server)
    Expected Result: stdout contains LOCAL_OK
    Failure Indicators: LOCAL_FAIL
    Evidence: .sisyphus/evidence/task-24-localhost-bind.log

  Scenario: Production build succeeds
    Tool: Bash
    Preconditions: Task 24 complete
    Steps:
      1. yarn workspace @to-much-talker/playground build
      2. ls apps/playground/dist (or .vinxi/output)
    Expected Result: build artifacts exist; exit 0
    Failure Indicators: build error
    Evidence: .sisyphus/evidence/task-24-build.log
  ```

  **Evidence to Capture**:
  - [ ] `task-24-localhost-bind.log`, `task-24-build.log`

  **Commit**: YES
  - Message: `feat(playground): scaffold TanStack Start app with Shadcn New York, Tailwind v4, i18n, localhost bind`
  - Files: `apps/playground/**`

- [x] 25. `apps/playground` TTS sandbox page

  **What to do**:
  - Create `apps/playground/src/app/sandbox.tsx` (route file)
  - Form (TanStack Form + zod) with fields: model (Select from allowed list), voice (text), text (textarea, 0–2000 chars, live count via TanStack Pacer debouncing), api-key (password input, defaults to env or DB-stored)
  - Submit: server function calls `@to-much-talker/ai.synthesize`; if `PLAYGROUND_MOCK_OPENROUTER=1`, return a hardcoded 1-second MP3 from `apps/playground/src/fixtures/mock-tts.mp3`
  - Result panel: HTML5 `<audio controls>` with the response audio (blob URL); download button; show response metadata (model, voice, chars, est cost, actual cost)
  - Error states: 401/network/upstream errors shown clearly in localized text
  - History sidebar: last 10 calls in this session (in-memory)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 26
  - **Parallel Group**: Wave 6b
  - **Blocks**: 31
  - **Blocked By**: 10, 24

  **References**:
  - **External References**:
    - TanStack Form: https://tanstack.com/form/v1/docs/overview
    - TanStack Pacer: https://tanstack.com/pacer/latest/docs/overview

  **Acceptance Criteria**:
  - [ ] `/sandbox` route renders form
  - [ ] Submitting valid form → audio plays in `<audio>` element (verified in Playwright Task 31)
  - [ ] Invalid input → form-level zod error
  - [ ] With `PLAYGROUND_MOCK_OPENROUTER=1`: any submission returns the fixture MP3

  **QA Scenarios**:

  ```
  Scenario: Sandbox route module exports a default route + form component
    Tool: Bash
    Preconditions: Task 25 complete
    Steps:
      1. node --import tsx -e "import('./apps/playground/src/app/sandbox.tsx').then(m => { if (!m.Route) process.exit(2); console.log('ok') })"
    Expected Result: stdout 'ok'
    Failure Indicators: missing export; module fails to import
    Evidence: .sisyphus/evidence/task-25-sandbox-module.log

  Scenario: Sandbox form zod schema validates as expected (unit-level)
    Tool: Bash (Vitest)
    Preconditions: Task 25 complete
    Steps:
      1. yarn workspace @to-much-talker/playground vitest run src/components/sandbox/schema.test.ts
    Expected Result: tests pass (covering: empty text rejected, text > 2000 rejected, valid input accepted, model required)
    Failure Indicators: any failed assertion
    Evidence: .sisyphus/evidence/task-25-sandbox-schema.log
  ```

  > Full browser-level e2e evidence (clicking submit, hearing audio, locale switch) is captured in Task 31 via Playwright. Tasks 25 and 31 BOTH produce evidence; Task 31's evidence is the integration check that ties this task's output to user behavior.

  **Evidence to Capture**:
  - [ ] `task-25-sandbox-module.log`, `task-25-sandbox-schema.log`
  - (additionally, `task-31-sandbox-happy.{log,png}` after Task 31 runs)

  **Commit**: YES
  - Message: `feat(playground): add TTS sandbox page with form, audio playback, and history`
  - Files: `apps/playground/src/app/sandbox.tsx, apps/playground/src/components/sandbox/**, apps/playground/src/fixtures/mock-tts.mp3`

- [x] 26. `apps/playground` settings inspector + audit log viewer

  **What to do**:
  - Create `apps/playground/src/app/{settings.tsx,audit.tsx}`
  - Settings inspector: form to pick guild_id (text), channel_id (optional), user_id (optional) → server function loads server/channel/user rows from DB + computes resolved values via `@to-much-talker/settings-core`'s `resolveSettings()` (the package already extracted in Task 11)
  - Visualization: 3-column table (Server, Channel, User) per key + final Resolved column with the clamp path explanation
  - Audit log viewer: table of last 200 entries with filters by guild/scope/key/actor

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 25
  - **Parallel Group**: Wave 6b
  - **Blocks**: 31
  - **Blocked By**: 8, 11, 24

  **References**:
  - **Pattern References**: `packages/settings-core/src/resolver.ts` (Task 11) — already a standalone package, simply import it

  **Acceptance Criteria**:
  - [ ] `/settings?guild=<id>` renders the 3-column resolution table
  - [ ] `/audit` renders audit rows with filtering
  - [ ] Read-only by default (no write buttons rendered unless `PLAYGROUND_WRITE_ENABLED=1`)

  **QA Scenarios**:

  ```
  Scenario: Settings & audit route modules import + export
    Tool: Bash
    Preconditions: Task 26 complete
    Steps:
      1. node --import tsx -e "Promise.all([import('./apps/playground/src/app/settings.tsx'), import('./apps/playground/src/app/audit.tsx')]).then(([s,a]) => { if (!s.Route || !a.Route) process.exit(2); console.log('ok') })"
    Expected Result: stdout 'ok'
    Failure Indicators: missing exports; module errors
    Evidence: .sisyphus/evidence/task-26-modules.log

  Scenario: Resolver presentation logic produces correct table rows (unit)
    Tool: Bash (Vitest)
    Preconditions: Task 26 complete + Task 11 settings-core
    Steps:
      1. yarn workspace @to-much-talker/playground vitest run src/components/inspector/format.test.ts
    Expected Result: tests pass — covers: clamped value path produces "channel clamps user" string; null inputs default correctly; missing channel falls back to server
    Failure Indicators: assertion failures
    Evidence: .sisyphus/evidence/task-26-format.log
  ```

  > Full browser e2e (resolved value rendered in DOM) captured in Task 31.

  **Evidence to Capture**:
  - [ ] `task-26-modules.log`, `task-26-format.log`
  - (additionally, `task-31-settings-resolve.{log,png}` after Task 31 runs)

  **Commit**: YES
  - Message: `feat(playground): add settings inspector and audit log viewer`
  - Files: `apps/playground/src/app/{settings,audit}.tsx, apps/playground/src/components/inspector/**`

- [x] 27. `apps/docs` scaffolding — TanStack Start SSR + markdown pipeline + Pagefind + i18n

  **What to do**:
  - Create `apps/docs/{package.json,tsconfig.json,vite.config.ts,app.config.ts,tailwind.config.css,src/{app/router.tsx,app/__root.tsx,app/$slug.tsx (markdown route),app/[locale]/$slug.tsx,lib/{content.ts,markdown.ts}},content/{en,ko,ja}/**,AGENTS.md,README.md}`
  - Markdown pipeline (per TanStack Start guide referenced by user):
    - Use `remark-parse` + `remark-rehype` + `rehype-stringify`
    - Plugins: `remark-gfm` (GFM), `remark-frontmatter` + `gray-matter` (YAML frontmatter), `rehype-shiki` (syntax highlighting with both light & dark themes), `remark-callouts` or custom plugin for admonitions (`:::note`/`:::warning`/`:::tip`/`:::danger`)
  - Routing: `/[locale?]/guide/...` and `/[locale?]/contributing/...`; locale prefix optional (default redirects to `en`)
  - SSR: TanStack Start server mode; markdown rendered server-side from file system; cached
  - Pagefind: build-time integration via `pagefind` package; postbuild script runs `pagefind --site dist` to generate static index; client-side `<PagefindSearch>` component uses `pagefind` UI module
  - Tailwind v4 + `@tailwindcss/typography` plugin for prose styles
  - AGENTS.md: markdown content discipline (frontmatter required: title, description, order); locale fallback rules; new pages → add to nav config

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 24 (different app)
  - **Parallel Group**: Wave 6a
  - **Blocks**: 28, 32
  - **Blocked By**: 5

  **References**:
  - **External References**:
    - TanStack Start markdown guide: https://tanstack.com/start/v0/docs/framework/react/guide/rendering-markdown.md
    - Pagefind: https://pagefind.app/docs/
    - rehype-shiki: https://github.com/shikijs/shiki/tree/main/packages/rehype
    - Tailwind typography: https://tailwindcss.com/docs/typography-plugin

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/docs build` produces SSR build + Pagefind index
  - [ ] `yarn workspace @to-much-talker/docs start` (or preview) serves SSR responses for `/` and `/guide/...`
  - [ ] Visiting a guide page returns server-rendered HTML (verified by `curl ... | grep '<h1>'`)
  - [ ] Pagefind index files exist under `dist/pagefind/`
  - [ ] Locale switch on a page changes content if a translated version exists; falls back to en otherwise

  **QA Scenarios**:

  ```
  Scenario: Server returns SSR HTML for guide page
    Tool: Bash + interactive_bash
    Preconditions: Task 27 complete + at least one content file in content/en/guide/install.md
    Steps:
      1. yarn workspace @to-much-talker/docs build
      2. (in tmux) yarn workspace @to-much-talker/docs start &
      3. After 3s: curl -s http://127.0.0.1:4000/guide/install | grep -c '<h1>'
    Expected Result: count >= 1
    Failure Indicators: 0 or curl fails
    Evidence: .sisyphus/evidence/task-27-ssr.log

  Scenario: Pagefind index built
    Tool: Bash
    Preconditions: Task 27 complete
    Steps:
      1. yarn workspace @to-much-talker/docs build
      2. ls apps/docs/dist/pagefind/
    Expected Result: directory contains pagefind.js and an index file
    Evidence: .sisyphus/evidence/task-27-pagefind.log
  ```

  **Evidence to Capture**:
  - [ ] `task-27-ssr.log`, `task-27-pagefind.log`

  **Commit**: YES
  - Message: `feat(docs): scaffold TanStack Start SSR with markdown pipeline (GFM, Shiki, admonitions), Pagefind, i18n`
  - Files: `apps/docs/**`

- [x] 28. `apps/docs` content seed — install, configure, commands, security, contributing, architecture

  **What to do**:
  - Create initial content tree under `apps/docs/content/en/` (translations for ko/ja deferred to per-page incremental work):
    - `guide/install.md` — Docker quickstart (`docker run` example) + docker-compose example
    - `guide/configure.md` — env vars table + `/tts setup` walk-through
    - `guide/commands.md` — slash commands reference with parameters
    - `guide/security.md` — API key storage, key rotation procedure
    - `guide/troubleshooting.md` — common errors, log inspection
    - `contributing/architecture.md` — repo map, package responsibilities
    - `contributing/dev-setup.md` — clone, install, run, test
    - `contributing/agents-md.md` — overview of the AGENTS.md hierarchy
    - `contributing/release.md` — Changesets flow
  - Each file has YAML frontmatter (`title`, `description`, `order`)
  - Navigation config in `apps/docs/src/lib/nav.ts` listing all pages in order

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with later wave tasks within Wave 6
  - **Parallel Group**: Wave 6b
  - **Blocks**: 32
  - **Blocked By**: 27

  **References**:
  - **Pattern References**:
    - Task 1 root `AGENTS.md` — describes architecture map; cite & link from `contributing/architecture.md`
    - Task 18 `key gen` / `key rotate` CLI — described in `guide/security.md`
    - Task 21 slash commands list — described in `guide/commands.md`
    - Task 12 env vars — described in `guide/configure.md`

  **Acceptance Criteria**:
  - [ ] All 9 listed files exist with frontmatter
  - [ ] Each file builds to HTML without remark errors
  - [ ] Nav config references each file

  **QA Scenarios**:

  ```
  Scenario: All seed pages build
    Tool: Bash
    Preconditions: Task 28 complete
    Steps:
      1. yarn workspace @to-much-talker/docs build
      2. find apps/docs/dist -name "*.html" | wc -l
    Expected Result: count >= 9 (one per page)
    Failure Indicators: build errors; missing files
    Evidence: .sisyphus/evidence/task-28-pages-build.log

  Scenario: Navigation contains all seed pages
    Tool: Bash
    Preconditions: Task 28 complete
    Steps:
      1. node --import tsx -e "import('./apps/docs/src/lib/nav.ts').then(n => { const slugs = n.nav.flatMap(s => s.items.map(i => i.slug)); console.log(slugs.length) })"
    Expected Result: stdout >= 9
    Evidence: .sisyphus/evidence/task-28-nav.log
  ```

  **Evidence to Capture**:
  - [ ] `task-28-pages-build.log`, `task-28-nav.log`

  **Commit**: YES
  - Message: `docs: seed initial content (install, configure, commands, security, troubleshooting, contributing)`
  - Files: `apps/docs/content/en/**, apps/docs/src/lib/nav.ts`

- [x] 29. Unit + integration test suite (crypto, settings, queue, cost, DB, i18n, slash commands)

  **What to do**:
  - Add Vitest configs at root (`vitest.config.ts`) and per-workspace where needed; configure project-roots for monorepo so `yarn turbo run test` discovers all suites
  - Unit tests:
    - `packages/crypto`: roundtrip property test (fast-check) for 100 random plaintexts; wrong-key returns Result.err; KeyRing version lookup; envelope encode/decode roundtrip
    - `packages/settings-core/src/resolver.test.ts`: 12+ cases for clamping semantics across all setting types (numeric, enum, allowlist override)
    - `packages/settings-core/src/cache.test.ts`: LRU eviction; invalidate(guildId) evicts only that guild's entries; TTL expiration
    - `apps/server/src/queue/*.test.ts`: each strategy passes its semantic spec; queue manager handles multi-channel correctly
    - `apps/server/src/cost/estimate.test.ts`: char-cap, price-cap, clamped settings
    - `packages/db/src/dialect.test.ts`: detectDialect happy and error paths
  - Integration tests (use `@to-much-talker/test-utils`):
    - DB: open in-memory SQLite, run migrations, CRUD against all 5 tables, then assert (`packages/db/__tests__/sqlite.int.test.ts`)
    - DB: same against ephemeral Postgres via testcontainers, gated by `RUN_PG_TESTS=1` (`packages/db/__tests__/pg.int.test.ts`)
    - Slash command `/tts join`: mocked interaction → handler → assertions on side effects (voice join, reply)
    - Slash command `/tts settings server set`: writes row + audit row + invalidates cache
    - Settings IPC: simulate manager broadcast → worker receives → cache evicted
    - i18n: every command's message key resolves in all 3 locales (no missing translations)
  - Add a `test:watch` script for dev and `test` for CI; coverage threshold (start at 70%, ratchet up later)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 30, 31, 32
  - **Parallel Group**: Wave 7
  - **Blocks**: F2
  - **Blocked By**: 4, 6, 7, 11, 15

  **References**:
  - **External References**:
    - Vitest workspace: https://vitest.dev/guide/workspace
    - testcontainers: https://node.testcontainers.org/

  **Acceptance Criteria**:
  - [ ] `yarn turbo run test` runs all suites; passes
  - [ ] Coverage report generated under `coverage/` (per workspace)
  - [ ] At least one test per package under `packages/*`
  - [ ] At least one integration test for each Wave-4/5 module

  **QA Scenarios**:

  ```
  Scenario: Full test suite passes
    Tool: Bash
    Preconditions: All Wave 1-6 tasks complete
    Steps:
      1. yarn install (ensure deps)
      2. yarn turbo run test --output-logs=full > /tmp/test.log 2>&1
      3. grep -E "Tests +([0-9]+) passed" /tmp/test.log
    Expected Result: nonzero match; no "failed" lines
    Failure Indicators: any "FAIL" or non-zero exit
    Evidence: .sisyphus/evidence/task-29-suite.log

  Scenario: Coverage report generated
    Tool: Bash
    Preconditions: Task 29 complete
    Steps:
      1. yarn turbo run test -- --coverage
      2. find . -path ./node_modules -prune -o -name "coverage-summary.json" -print
    Expected Result: at least one coverage-summary.json found per workspace with tests
    Evidence: .sisyphus/evidence/task-29-coverage.log
  ```

  **Evidence to Capture**:
  - [ ] `task-29-suite.log`, `task-29-coverage.log`

  **Commit**: YES
  - Message: `test: add unit and integration tests for crypto, settings, queue, cost, db, and slash commands`
  - Files: `vitest.config.ts, packages/**/*.test.ts, apps/server/src/**/*.test.ts`

- [x] 30. Bot smoke test (mocked Discord: start → join → mocked TTS → leave)

  **What to do**:
  - Create `apps/server/test/smoke.test.ts`:
    - Boot the bot with `MOCK_DISCORD=1` (a flag honored by the client factory in Task 13 to return a stubbed Client + Gateway)
    - Fire mocked `interactionCreate` events: `/tts join` → assert voice connection created → fire mocked TTS payload (audio buffer from `apps/server/test/fixtures/mock-tts.mp3`) through queue → assert Player played frames → fire `/tts leave` → assert connection destroyed
    - Edge case: simulate WS disconnect mid-playback → assert reattach
    - Edge case: simulate voice channel empties → assert idle-leave fires
  - Add `test:smoke` script in `apps/server/package.json`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 29, 31, 32
  - **Parallel Group**: Wave 7
  - **Blocks**: F2
  - **Blocked By**: 6, 17

  **References**:
  - **Pattern References**: `@to-much-talker/test-utils` builders (Task 6)

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/server test:smoke` exits 0
  - [ ] Test covers: boot, /tts join, mocked TTS play, /tts leave, WS disconnect, voice empty → idle-leave

  **QA Scenarios**:

  ```
  Scenario: Smoke test full flow
    Tool: Bash
    Preconditions: Task 30 complete
    Steps:
      1. yarn workspace @to-much-talker/server test:smoke
    Expected Result: exit 0; output lists all scenarios passed
    Failure Indicators: any failure
    Evidence: .sisyphus/evidence/task-30-smoke.log
  ```

  **Evidence to Capture**:
  - [ ] `task-30-smoke.log`

  **Commit**: YES
  - Message: `test(server): add bot smoke test with mocked Discord (join, TTS, leave, reconnect, idle)`
  - Files: `apps/server/test/smoke.test.ts, apps/server/test/fixtures/mock-tts.mp3`

- [x] 31. Playwright e2e — playground (TTS sandbox + settings inspector + audit viewer)

  **What to do**:
  - Add `apps/playground/playwright.config.ts`: project for chromium; `webServer` configured to run `yarn dev` (or build + preview) on 5173
  - Container mode: `apps/playground/tests/e2e/`:
    - `sandbox.spec.ts`:
      - Test 1 (happy path): set `PLAYGROUND_MOCK_OPENROUTER=1`; navigate; fill text "hello"; submit; assert `<audio>` element has non-empty `src`; assert metadata panel shows `chars=5`
      - Test 2 (zod error): submit empty text; assert error message present (localized)
      - Test 3 (locale switch): change locale to ko; assert page title is localized
    - `settings.spec.ts`:
      - Seed DB with known fixtures via a global setup script using `@to-much-talker/test-utils`
      - Navigate `/settings?guild=g1&channel=c1&user=u1`
      - Assert 3-column table renders; Resolved column shows correct clamped value with explanation
    - `audit.spec.ts`: filter by guild → assert correct rows
  - CI integration: `e2e.yml` runs Playwright in `mcr.microsoft.com/playwright:v<version>` container

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `playwright-cli`

  **Parallelization**:
  - **Can Run In Parallel**: YES with 29, 30, 32
  - **Parallel Group**: Wave 7
  - **Blocks**: F2
  - **Blocked By**: 25, 26

  **References**:
  - **External References**:
    - Playwright Docker: https://playwright.dev/docs/docker
    - Playwright TanStack Start config: standard `webServer` block

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/playground test:e2e` exits 0 locally
  - [ ] All three test files pass with mocked OpenRouter
  - [ ] Screenshots captured for each test on failure (config: `use: { screenshot: 'only-on-failure' }`)

  **QA Scenarios**:

  ```
  Scenario: Sandbox happy path e2e
    Tool: Playwright (via skill)
    Preconditions: Task 31 complete + Task 25 happy
    Steps:
      1. playwright test apps/playground/tests/e2e/sandbox.spec.ts -g 'happy path'
    Expected Result: pass
    Evidence: .sisyphus/evidence/task-31-sandbox-e2e.log + screenshots

  Scenario: Settings inspector resolves clamps
    Tool: Playwright (via skill)
    Preconditions: Task 31 complete + seeded fixtures
    Steps:
      1. playwright test apps/playground/tests/e2e/settings.spec.ts
    Expected Result: pass with screenshot showing clamped value
    Evidence: .sisyphus/evidence/task-31-settings-e2e.log + screenshots
  ```

  **Evidence to Capture**:
  - [ ] `task-31-sandbox-e2e.log`, `task-31-settings-e2e.log`, screenshots under `apps/playground/test-results/`

  **Commit**: YES
  - Message: `test(playground): add Playwright e2e for sandbox, settings inspector, and audit viewer`
  - Files: `apps/playground/playwright.config.ts, apps/playground/tests/e2e/**`

- [x] 32. Playwright e2e — docs (page render + Pagefind search + locale routing)

  **What to do**:
  - Add `apps/docs/playwright.config.ts` similar to playground
  - `apps/docs/tests/e2e/`:
    - `render.spec.ts`: navigate `/guide/install`; assert `<h1>` content matches frontmatter title; assert prose has elements like `<code>`, `<table>` (rendered from GFM markdown)
    - `search.spec.ts`: type a known term into Pagefind search box; assert at least 1 result; click; assert navigation to expected page
    - `locale.spec.ts`: navigate `/ja/guide/install`; if translation exists assert ja content; else assert fallback to en + a "translation missing" banner
    - `admonition.spec.ts`: a content page with `:::note` block; assert the rendered HTML has the admonition class + icon

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `playwright-cli`

  **Parallelization**:
  - **Can Run In Parallel**: YES with 29, 30, 31
  - **Parallel Group**: Wave 7
  - **Blocks**: F2
  - **Blocked By**: 28

  **References**:
  - **External References**:
    - Pagefind API: https://pagefind.app/docs/api/

  **Acceptance Criteria**:
  - [ ] `yarn workspace @to-much-talker/docs test:e2e` exits 0
  - [ ] All four spec files pass

  **QA Scenarios**:

  ```
  Scenario: Docs page renders with admonition
    Tool: Playwright (via skill)
    Preconditions: Task 32 complete + content with :::note
    Steps:
      1. playwright test apps/docs/tests/e2e/admonition.spec.ts
    Expected Result: pass; screenshot shows admonition rendered
    Evidence: .sisyphus/evidence/task-32-admonition.log + screenshot

  Scenario: Pagefind search returns results
    Tool: Playwright (via skill)
    Preconditions: Task 32 complete
    Steps:
      1. playwright test apps/docs/tests/e2e/search.spec.ts
    Expected Result: pass
    Evidence: .sisyphus/evidence/task-32-search.log
  ```

  **Evidence to Capture**:
  - [ ] `task-32-admonition.log`, `task-32-search.log`, screenshots

  **Commit**: YES
  - Message: `test(docs): add Playwright e2e for render, Pagefind search, locale routing, admonitions`
  - Files: `apps/docs/playwright.config.ts, apps/docs/tests/e2e/**`

- [x] 33. `apps/server/Dockerfile` — node:24-slim + FFmpeg + multi-stage + non-root user

  **What to do**:
  - Multi-stage build:
    - `FROM node:24-slim AS deps`: install yarn, copy `package.json + yarn.lock + .yarnrc.yml + .yarn/`, run `yarn install --immutable`
    - `FROM node:24-slim AS builder`: copy from deps; copy source; run `yarn turbo run build --filter=@to-much-talker/server...`; produce `apps/server/dist`
    - `FROM node:24-slim AS runner`: install `ffmpeg` via apt; create `app` non-root user; copy compiled server + minimal node_modules (use `yarn workspaces focus --production` in builder stage for runtime deps); set workdir, USER, CMD `["node", "apps/server/dist/index.js", "start"]`
  - Healthcheck: HTTP endpoint disabled in v1 (no metrics) → use `CMD ["node", "-e", "require('discord.js')"]` as a basic liveness; or skip healthcheck (document)
  - Labels: OCI metadata (`org.opencontainers.image.source`, `.url`, `.licenses=MIT`)
  - `.dockerignore` at repo root: exclude `node_modules`, `.git`, `.turbo`, `dist`, `coverage`, `.sisyphus`, `.env*`, `data/`, `**/test-results`, `**/.vite`, etc.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 34
  - **Parallel Group**: Wave 8
  - **Blocks**: F3
  - **Blocked By**: 17

  **References**:
  - **External References**:
    - Node docker hub: https://hub.docker.com/_/node
    - Multi-stage builds: https://docs.docker.com/build/building/multi-stage/

  **Acceptance Criteria**:
  - [ ] `docker build -f apps/server/Dockerfile -t tmt-bot .` succeeds
  - [ ] Final image size ≤ 250MB
  - [ ] `docker run --rm tmt-bot --version` prints a version
  - [ ] Image runs as non-root: `docker run --rm tmt-bot id -u` prints a non-zero UID

  **QA Scenarios**:

  ```
  Scenario: Bot Docker image builds and runs CLI
    Tool: Bash
    Preconditions: Task 33 complete; Docker daemon available
    Steps:
      1. docker build -f apps/server/Dockerfile -t tmt-bot . 2>&1 | tee /tmp/build.log
      2. docker run --rm tmt-bot --version
    Expected Result: build exit 0; version printed
    Evidence: .sisyphus/evidence/task-33-build-run.log

  Scenario: Image is non-root and reasonably sized
    Tool: Bash
    Preconditions: Task 33 complete + image built
    Steps:
      1. docker run --rm tmt-bot id -u
      2. docker images tmt-bot --format '{{.Size}}'
    Expected Result: UID != 0; size text shows ≤ 250MB
    Evidence: .sisyphus/evidence/task-33-image-meta.log
  ```

  **Evidence to Capture**:
  - [ ] `task-33-build-run.log`, `task-33-image-meta.log`

  **Commit**: YES
  - Message: `build(server): add Dockerfile (node:24-slim, FFmpeg, multi-stage, non-root)`
  - Files: `apps/server/Dockerfile, .dockerignore`

- [x] 34. `apps/playground/Dockerfile` + `apps/docs/Dockerfile`

  **What to do**:
  - **Playground Dockerfile**: multi-stage like Task 33; no FFmpeg needed.
    - Inside the container, the playground binds to `0.0.0.0:5173` (the container itself is the isolation boundary; binding to localhost inside a container would make `docker run -p` useless). Set `PLAYGROUND_HOST=0.0.0.0` as an ENV in the Dockerfile.
    - **Important**: this is intentional — when running OUTSIDE Docker via `yarn dev` (Task 24), the host defaults to `127.0.0.1` for safety; when running INSIDE Docker, the operator opts into network exposure via `docker run -p`.
    - Label image as `org.opencontainers.image.description="DEV-ONLY — do NOT expose publicly"` and add a CMD wrapper that prints a red WARNING banner on startup reminding operators not to publish this container.
  - **Docs Dockerfile**: multi-stage; SSR runtime; binds to `0.0.0.0:4000` (intended for public deployment); copy Pagefind index from build

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with 33
  - **Parallel Group**: Wave 8
  - **Blocks**: F3
  - **Blocked By**: 25, 28

  **References**:
  - **Pattern References**: Task 33 Dockerfile pattern

  **Acceptance Criteria**:
  - [ ] Both Dockerfiles build
  - [ ] `docker run --rm -p 5173:5173 tmt-playground` serves the dev page on 127.0.0.1:5173 (port mapping works)
  - [ ] `docker run --rm -p 4000:4000 tmt-docs` serves docs on `:4000`; `curl http://127.0.0.1:4000/` returns 200

  **QA Scenarios**:

  ```
  Scenario: Both web images build and serve
    Tool: Bash
    Preconditions: Task 34 complete
    Steps:
      1. docker build -f apps/playground/Dockerfile -t tmt-playground .
      2. docker build -f apps/docs/Dockerfile -t tmt-docs .
      3. (tmux) docker run --rm -p 4000:4000 tmt-docs &
      4. After 5s: curl -sf http://127.0.0.1:4000/ -o /dev/null && echo OK
    Expected Result: 'OK' printed
    Evidence: .sisyphus/evidence/task-34-web-images.log
  ```

  **Evidence to Capture**:
  - [ ] `task-34-web-images.log`

  **Commit**: YES
  - Message: `build(playground,docs): add Dockerfiles for playground (dev-only) and docs (SSR)`
  - Files: `apps/playground/Dockerfile, apps/docs/Dockerfile`

- [x] 35. docker-compose example + .env.example updates

  **What to do**:
  - Create `docker-compose.yml` (project-root example for self-hosters):
    - `bot` service: `image: ghcr.io/<owner>/to-much-talker-bot:latest`; env from `.env`; volume `./data:/data`; restart unless-stopped
    - `postgres` service (commented out by default): `image: postgres:16-alpine`; env (POSTGRES_PASSWORD via .env); volume; uncomment + set `DATABASE_URL=postgres://...` in `.env` to switch
    - Note: docs service is published separately to a static host (not run via docker-compose by default)
  - Update `.env.example` with all envs documented per Round 12

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES with other Wave 8 tasks
  - **Parallel Group**: Wave 8
  - **Blocks**: F3
  - **Blocked By**: 33

  **Acceptance Criteria**:
  - [ ] `docker compose config` succeeds (validates compose file)
  - [ ] `.env.example` mentions all required env vars

  **QA Scenarios**:

  ```
  Scenario: compose config is valid
    Tool: Bash
    Preconditions: Task 35 complete
    Steps:
      1. docker compose config
    Expected Result: exit 0
    Evidence: .sisyphus/evidence/task-35-compose.log
  ```

  **Evidence to Capture**:
  - [ ] `task-35-compose.log`

  **Commit**: YES
  - Message: `chore: add docker-compose example and update .env.example with all env vars`
  - Files: `docker-compose.yml, .env.example`

- [x] 36. GH Actions — `ci.yml` (lint+typecheck+test) + `e2e.yml` (Playwright with containers)

  **What to do**:
  - `.github/workflows/ci.yml`:
    - on: push, pull_request
    - jobs: `ci` → checkout, setup-node@v4 (24), `corepack enable`, cache `.yarn/cache`, `yarn install --immutable`, `yarn turbo run lint typecheck test build --output-logs=full`
    - Concurrency group `ci-${{ github.ref }}` cancel-in-progress true
    - Upload coverage as artifact (optional)
  - `.github/workflows/e2e.yml`:
    - on: pull_request to main + push to main
    - Two jobs (parallel): `playground-e2e` and `docs-e2e`
    - Each uses `container: image: mcr.microsoft.com/playwright:v<pinned-version>` (pin Playwright version)
    - Install with `yarn install --immutable`; build the target app; run `yarn workspace @to-much-talker/<app> test:e2e`
    - Upload `test-results/` as artifact on failure

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `gh-cli` (for verifying the workflow once committed)

  **Parallelization**:
  - **Can Run In Parallel**: YES with 37
  - **Parallel Group**: Wave 8
  - **Blocks**: F4
  - **Blocked By**: 29-32

  **References**:
  - **External References**:
    - GH Actions setup-node: https://github.com/actions/setup-node
    - Playwright Docker in CI: https://playwright.dev/docs/ci#docker

  **Acceptance Criteria**:
  - [ ] `actionlint` (or `yamllint`) passes on both workflow files
  - [ ] Workflow exists and is syntactically valid (verified via `gh workflow list` after first push, deferred for QA)

  **QA Scenarios**:

  ```
  Scenario: Workflow YAML is syntactically valid
    Tool: Bash (actionlint if available; else yamllint)
    Preconditions: Task 36 complete
    Steps:
      1. actionlint .github/workflows/ci.yml .github/workflows/e2e.yml 2>&1
    Expected Result: 0 errors; exit 0
    Failure Indicators: any error report
    Evidence: .sisyphus/evidence/task-36-actionlint.log
  ```

  **Evidence to Capture**:
  - [ ] `task-36-actionlint.log`

  **Commit**: YES
  - Message: `ci: add GitHub Actions workflows for lint+typecheck+test and Playwright e2e`
  - Files: `.github/workflows/{ci,e2e}.yml`

- [x] 37. GH Actions — `release.yml` (Changesets) + `docker.yml` (build & push 3 images to GHCR)

  **What to do**:
  - `.github/workflows/release.yml`:
    - on: push to main (excluding release commits to avoid loops)
    - Use `changesets/action@v1` to open a "Version Packages" PR or publish on push of a version commit
    - Token: `GITHUB_TOKEN` (auto)
    - Trigger downstream `docker.yml` workflow via `repository_dispatch` or rely on the tag push
  - `.github/workflows/docker.yml`:
    - on: push tags `v*`, manual workflow_dispatch
    - Three parallel jobs: `build-bot`, `build-playground`, `build-docs`
    - Each: `docker/setup-buildx-action`; `docker/login-action@v3` (registry ghcr.io, with `GITHUB_TOKEN`); `docker/build-push-action@v6` with `platforms: linux/amd64` only; tag using `docker/metadata-action` producing `v1.2.3, 1.2, 1, latest, edge`
  - Confirm OCI labels propagate from Dockerfile

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `gh-cli`

  **Parallelization**:
  - **Can Run In Parallel**: YES with 36
  - **Parallel Group**: Wave 8
  - **Blocks**: F4
  - **Blocked By**: 33, 34

  **References**:
  - **External References**:
    - Changesets action: https://github.com/changesets/action
    - docker/build-push-action: https://github.com/docker/build-push-action
    - GHCR auth: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry

  **Acceptance Criteria**:
  - [ ] `actionlint` passes on both files
  - [ ] `docker.yml` references three separate build jobs with correct Dockerfile paths and tags
  - [ ] `release.yml` uses Changesets standard pattern

  **QA Scenarios**:

  ```
  Scenario: Release + Docker workflows validate
    Tool: Bash
    Preconditions: Task 37 complete
    Steps:
      1. actionlint .github/workflows/release.yml .github/workflows/docker.yml
    Expected Result: 0 errors
    Failure Indicators: any error report
    Evidence: .sisyphus/evidence/task-37-actionlint.log

  Scenario: docker.yml has three build jobs targeting correct Dockerfiles
    Tool: Bash (grep)
    Preconditions: Task 37 complete
    Steps:
      1. grep -E "Dockerfile" .github/workflows/docker.yml | sort
    Expected Result: three lines, each pointing to apps/server, apps/playground, apps/docs
    Evidence: .sisyphus/evidence/task-37-docker-jobs.log
  ```

  **Evidence to Capture**:
  - [ ] `task-37-actionlint.log`, `task-37-docker-jobs.log`

  **Commit**: YES
  - Message: `ci: add Changesets release and Docker publish workflows for three images`
  - Files: `.github/workflows/{release,docker}.yml`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.**

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. For each "Must Have": verify implementation exists in the repo (read file, run command). For each "Must NOT Have": grep the codebase for forbidden patterns (e.g. `as any`, default exports, emojis, Python files, Sentry imports, `console.log` outside CLI entry, Redis usage). Verify the dispatch summary's counts match actual task waves executed. Check evidence files exist for every Wave 1-8 task.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | Evidence files [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `yarn turbo run lint typecheck test build`. Review all changed files for: `as any`, `@ts-ignore` (vs `@ts-expect-error` with reason), empty catch blocks, `console.log` outside CLI entry, commented-out code, unused imports, default exports, emojis, Python files anywhere. Check AI slop: excessive comments, over-abstraction, generic names (`data/result/item/temp`), boilerplate-heavy "documentation" comments restating obvious code.
  Output: `Lint [PASS/FAIL] | Typecheck [PASS/FAIL] | Tests [N pass / N fail] | Files [N clean / N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright-cli` skill)
  Start from a fresh clone of the repo state. Run `yarn install && yarn build` from scratch. Run each Dockerfile build. For the bot: run smoke test mocking Discord, verify it starts and registers commands. For the playground: build, serve on localhost, run Playwright TTS sandbox happy path + error path scenarios. For the docs: build, serve, navigate to a guide page, run Pagefind search, verify locale switching. Save all evidence (screenshots, terminal outputs, response JSON) to `.sisyphus/evidence/final-qa/`.
  Output: `Bot smoke [PASS/FAIL] | Playground e2e [N/N] | Docs e2e [N/N] | Docker builds [3/3] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task in this plan: read "What to do", read actual diff (`git log` + `git diff` since plan start). Verify 1:1 — everything specified was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance per-task. Detect cross-task contamination: did Task N touch files owned by Task M? Flag unaccounted-for changes. Confirm the EXCLUDE list (Redis, Sentry, multi-arch, Python, etc.) is honored.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted files [CLEAN/N] | EXCLUDE-list violations [0/N] | VERDICT`

---

## Commit Strategy

> Commits are atomic per task; group tightly related sub-edits into a single commit. Use Conventional Commits format. Branch is `feature/scaffold-to-much-talker` (renamed from auto-generated `opencode/*`).

Suggested commits per wave (executor adjusts as needed):

- **Wave 1**: `chore: scaffold monorepo workspaces, turborepo, eslint, prettier, lefthook, changesets`
- **Wave 2**: one commit per package — `feat(shared): add types and Result helpers`, `feat(config): add zod env schema`, `feat(crypto): add AES-256-GCM with key versioning`, `feat(i18n): set up Paraglide JS with en/ko/ja locales`, `feat(test-utils): add mocked Discord interaction builders`, `feat(db): add parallel SQLite and Postgres schemas`
- **Wave 3**: `feat(db): add Db discriminated union and runtime selection`, `feat(db): add per-dialect migrations`, `feat(ai): add OpenRouter client with TTS via openai SDK`, `feat(server): add settings resolver and IPC invalidator`
- **Wave 4–5**: per-task `feat(server): ...` commits
- **Wave 6**: `feat(playground): scaffold TanStack Start app with Shadcn`, `feat(playground): add TTS sandbox`, `feat(playground): add settings inspector and audit viewer`, `feat(docs): scaffold TanStack Start SSR with markdown pipeline`, `docs: seed initial content`
- **Wave 7**: `test: add unit and integration tests`, `test: add bot smoke test`, `test(playground): add Playwright e2e`, `test(docs): add Playwright e2e`
- **Wave 8**: `build: add server Dockerfile`, `build: add playground and docs Dockerfiles`, `chore: add docker-compose example`, `ci: add GH Actions workflows for ci and e2e`, `ci: add release and docker publish workflows`

---

## Success Criteria

### Verification Commands

```bash
# Build & test the whole monorepo
yarn install                                              # Expected: clean install, no errors
yarn turbo run lint typecheck test build                  # Expected: 0 failures

# Per-app build
yarn workspace @to-much-talker/server build
yarn workspace @to-much-talker/playground build
yarn workspace @to-much-talker/docs build

# Docker builds
docker build -f apps/server/Dockerfile -t tmt-bot .
docker build -f apps/playground/Dockerfile -t tmt-playground .
docker build -f apps/docs/Dockerfile -t tmt-docs .

# CLI smoke
docker run --rm tmt-bot --version
docker run --rm tmt-bot key gen | head -c 64

# Bot smoke test (mocked Discord)
yarn workspace @to-much-talker/server test:smoke

# Playwright e2e
yarn workspace @to-much-talker/playground test:e2e
yarn workspace @to-much-talker/docs test:e2e

# Sanity: forbidden patterns absent
! grep -RIn --include='*.ts' --include='*.tsx' 'as any' src apps packages
! grep -RIn --include='*.ts' --include='*.tsx' '@ts-ignore' src apps packages
! find . -name '*.py' -not -path './node_modules/*'

# License + AGENTS.md presence
test -f LICENSE && grep -q 'MIT' LICENSE
test -f AGENTS.md
test -f apps/server/AGENTS.md
test -f apps/playground/AGENTS.md
test -f apps/docs/AGENTS.md
test -f packages/db/AGENTS.md
test -f packages/ai/AGENTS.md
test -f packages/i18n/AGENTS.md
test -f packages/config/AGENTS.md
test -f packages/shared/AGENTS.md
test -f packages/crypto/AGENTS.md
test -f packages/settings-core/AGENTS.md
test -f packages/test-utils/AGENTS.md
```

### Final Checklist

- [ ] All "Must Have" items present (verified by F1)
- [ ] All "Must NOT Have" items absent (verified by F1 + F4)
- [ ] All tests pass on a clean checkout (verified by F2)
- [ ] All Dockerfiles build (verified by F3)
- [ ] Bot smoke test passes (verified by F3)
- [ ] Playground + docs e2e pass (verified by F3)
- [ ] Plan scope honored 1:1 (verified by F4)
- [ ] User has given explicit "okay" after reviewing F1–F4 consolidated report
