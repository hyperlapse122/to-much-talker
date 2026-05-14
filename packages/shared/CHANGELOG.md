# @to-much-talker/shared

## 0.2.0

### Minor Changes

- 5fb6c73: `v0.2.0`: configurable per-message limits, gap-free playback, and voice-channel-bound reading.

  ### `@to-much-talker/server`
  - **New `/tts settings server-max-chars` and `/tts settings channel-max-chars`
    subcommands** — view, set, or reset the per-message character limit at the
    server or channel scope. Values clamp through the existing settings
    hierarchy (User ≤ Channel ≤ Server) so a channel override cannot exceed
    the server cap. Integer range `1..2000`.
  - **`/tts say` honors the configured limit at runtime** — the resolved limit
    flows through the runtime cache, and oversize messages are rejected with a
    localized error instead of being truncated silently.
  - **`/tts join` now binds the reader to the voice channel's chat**, not the
    text channel where the command was invoked. Joining a voice channel from
    any text channel makes the bot read that voice channel's built-in chat.
  - **Queued audio prefetch (depth 3)** — the next up-to-three queued segments
    are synthesized while the current one is playing, eliminating audible gaps
    between back-to-back messages on the queue.

  ### `@to-much-talker/settings-core`
  - New `serverMaxChars` and `channelMaxChars` clamps wired into the resolver
    with hierarchy enforcement and round-trip tests.

  ### `@to-much-talker/i18n`
  - New message keys for the `server-max-chars` / `channel-max-chars` flows in
    `en`, `ko`, `ja`.

  ### `@to-much-talker/docs`
  - Markdown headings normalized to array shorthand to avoid hydration drift.
  - `/tts join` command page clarifies that the reader is bound to the voice
    channel's chat.

  ### CI / release pipeline
  - `release.yml` now publishes a GitHub Release with extracted CHANGELOG
    notes and explicitly dispatches the multi-arch Docker workflow on the
    freshly pushed `v*` tag.

## 0.1.0

### Minor Changes

- e6c106c: Initial release of the To Much Talker monorepo.

  `To Much Talker` is a Discord TTS bot that synthesizes voice via OpenRouter
  TTS models (Gemini Flash TTS, GPT-4o Mini TTS). It runs in cluster + shard
  mode, ships as multi-arch Docker images, and is accompanied by a dev-only
  playground and a public SSR markdown docs site.

  ## Apps

  ### `@to-much-talker/server`

  discord.js v14 Discord TTS bot.
  - Cluster + shard runtime via `discord-hybrid-sharding` (cluster manager
    forks worker processes; auto shard count or pinned via `TOTAL_SHARDS`).
  - Slash commands: `/tts join`, `/tts leave`, `/tts say`, `/tts settings *`,
    `/tts setup` wizard, `guildCreate` welcome DM.
  - Voice pipeline: `@discordjs/voice` + Opus codec, per-guild player + queue
    manager with drop-oldest / drop-newest / interrupt strategies, idle-leave
    on inactivity and empty voice channels.
  - Settings hierarchy (User ≤ Channel ≤ Server) with clamp semantics, RBAC
    via `permissions_role_id`, audit log with 90d TTL, and IPC-based LRU
    cache invalidation across cluster workers.
  - Per-guild BYOK OpenRouter API keys encrypted at rest with AES-256-GCM.
  - Pino structured logger with token / API-key / authorization redaction.
  - CLI: `start`, `migrate`, `key gen`, `key rotate` via `commander`.
  - Vite 8 SSR bundling; native modules (`@discordjs/opus`, `better-sqlite3`,
    `@discordjs/voice`, `prism-media`, `pino`, `discord.js`,
    `discord-hybrid-sharding`) kept external for runtime resolution.
  - Vite-driven dev runner (`apps/server/dev.mjs`) using `loadEnv` +
    `vite build --watch` + `node --watch` so `yarn dev` mirrors the
    "vite dev" UX for the Node-only bot.

  ### `@to-much-talker/playground`

  Dev-only TanStack Start playground. Shadcn UI on Tailwind v4. Intentionally
  omitted from `docker-compose.yml` because it MUST NOT be exposed publicly.

  ### `@to-much-talker/docs`

  Public SSR markdown docs site.
  - TanStack Start + content-collections markdown pipeline.
  - Unified + remark-gfm + Shiki syntax highlighting.
  - Pagefind-powered client-side search with keyboard navigation.
  - Filesystem-backed sidebar (no manual nav file).
  - Playwright e2e specs.
  - Authoritative user-facing setup guide at
    `apps/docs/content/en/guide/setup.md`.

  ## Packages
  - `@to-much-talker/shared` — types, branded IDs, `Result<T, E>` helpers,
    error classes (no throwing across module boundaries).
  - `@to-much-talker/config` — zod-validated env loader; the only place that
    reads `process.env`. Empty string env values are preprocessed to
    `undefined` so `.default()` clauses fire.
  - `@to-much-talker/crypto` — AES-256-GCM encryption with master-key
    versioning (`MASTER_ENC_KEY_VERSION`) for non-destructive key rotation.
  - `@to-much-talker/db` — Drizzle ORM dual-dialect schemas (SQLite +
    Postgres) as a discriminated union; dialect auto-detected from
    `DATABASE_URL`. SQLite default at `./data/bot.db`.
  - `@to-much-talker/ai` — OpenRouter client. TTS through the OpenAI SDK
    (OpenRouter is OpenAI-compatible). Chat through TanStack AI (playground
    only).
  - `@to-much-talker/i18n` — Paraglide JS compile-time message keys
    (`en` / `ko` / `ja`) with full SSR support and a Discord-locale mapping
    helper.
  - `@to-much-talker/settings-core` — settings resolver with clamping, LRU
    cache, and an `IpcTransport` interface for cross-worker invalidation.
  - `@to-much-talker/test-utils` — mocked Discord interaction builders and
    ephemeral DB helpers. Restricted to test files via ESLint rule.

  ## Build, Distribution & CI
  - Yarn 4 Berry workspaces (node-modules linker).
  - Turborepo pipeline with caching for `lint`, `typecheck`, `test`, `build`.
  - Vite 8 SSR bundling for every app under `apps/`. `ssr.noExternal: true`
    with an explicit `runtimeExternals` allowlist for native modules and
    `eval()`-using packages.
  - Multi-arch Docker images for `linux/amd64` + `linux/arm64` published to
    GHCR (`ghcr.io/hyperlapse122/to-much-talker/{server,playground,docs}`).
    Multi-arch pattern: native-runner per-arch build with
    `push-by-digest=true`, then `docker buildx imagetools create` to
    assemble the manifest list.
  - GitHub Actions workflows: `ci.yml` (lint + typecheck + tests),
    `docker.yml` (multi-arch image publish on `main` push, `v*` tag push,
    or `workflow_dispatch`), `docs-pages.yml` (docs site deploy),
    `e2e.yml` (Playwright), `release.yml` (Changesets-driven version PRs +
    publish + git tag).
  - Reference `docker-compose.yml` at the repo root with `bot` and
    `postgres` profiles. `bot` profile is standalone-valid; when both
    profiles are enabled the bot waits for the postgres healthcheck.

  ## Quality Gates
  - TypeScript strictest config across all packages.
  - ESLint flat config; no `as any`, no default exports (except mandated
    config files), no `console.log` outside CLI modules, no Python files.
  - Prettier + commitlint + lefthook pre-commit hook with auto-stage of
    ESLint / Prettier fixes.
  - 70+ Vitest unit + integration tests (config + server + docs + others).
  - Playwright e2e suites for docs and playground.

  ## Critical Operational Notes
  - **`MASTER_ENC_KEY`**: base64-encoded 32 bytes (AES-256-GCM). Losing or
    rotating it makes existing per-guild BYOK keys unrecoverable. Rotate
    non-destructively by incrementing `MASTER_ENC_KEY_VERSION` while
    keeping the previous key reachable for decryption.
  - **Discord interactions** must never time out — always `reply()` or
    `editReply()`. Voice connections must clean up on error/disconnect.
  - **`docker run --env-file`** populates the container's `process.env`;
    cluster-manager-forked workers inherit it. No `.env` file is required
    (or expected) inside the image.
  - **Sentry, Prometheus, Redis** are explicitly out of scope.

  ## Bootstrap Fixes Bundled with This Release

  The very first Docker bootstrap surfaced a chain of scaffold-level
  issues; all of them are fixed in this release.
  - `fix(server)`: drop `execArgv: ['--env-file=.env']` from the cluster
    manager. The flag broke worker fork inside containers
    (`node: .env: not found`); workers now inherit `process.env` from the
    parent, which is the canonical Node child-process pattern.
  - `feat(server)`: new `apps/server/dev.mjs` Vite-driven dev launcher
    (Vite `loadEnv` + `vite build --watch` + `node --watch`).
  - `fix(config)`: `EnvSchema` preprocesses empty string env values to
    `undefined` so `.default(...)` clauses actually fire. The unedited
    `.env.example` template is now a valid `.env` for the optional vars.
  - `fix(compose)`: `depends_on.postgres.required: false` makes
    `docker compose --profile bot up` a valid standalone invocation.
  - `docs(setup)`: expanded setup guide; every image-tag reference unified
    to `:latest`.
  - `docs(agents)`: root + `packages/config` AGENTS.md now require
    docs-site sync for env / Docker / startup changes.
  - `fix(hooks)`: lefthook `stage_fixed: true` so ESLint / Prettier
    auto-fixes land in the same commit instead of dangling in the working
    tree.
  - `chore(repo)`: ignore `out*/` produced by `turbo prune --docker`.
