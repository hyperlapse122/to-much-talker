# Task 8 Review Reconciliation Evidence

## Scope

Fetched the current PR metadata with:

- `gh repo view --json nameWithOwner --jq .nameWithOwner` -> `hyperlapse122/to-much-talker`
- `gh pr view --json number --jq .number` -> `9`
- `gh api repos/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/pulls/$(gh pr view --json number --jq .number)/comments --paginate`

The current PR comments were compared against the 11 original review comment IDs required by the task. All 11 IDs are present in the fetched comment set and mapped below to concrete fixes and tests.

## Comment Mapping

| Comment ID | Review concern | Task(s) | Changed file(s) | Verification evidence |
| --- | --- | --- | --- | --- |
| `3228255422` | `resolveUserTtsModel` allowed any supported built-in model even when the guild disallowed it. | Task 1 | `apps/server/src/commands/tts/runtime-cache.ts`, `apps/server/src/commands/tts/runtime-cache.test.ts` | `resolveUserTtsModel` now receives `guildId`, reads guild-scoped user settings, and returns the preferred model only when `runtime.allowedModels.includes(preferredModel)`; runtime-cache tests cover disallowed preferred model fallback. `yarn workspace @to-much-talker/server test` passed 5 files/41 tests. |
| `3228255428` | `/tts settings api-key` persisted a guild billing key without authorization. | Task 3 | `apps/server/src/commands/tts/settings/index.ts`, `apps/server/src/smoke.test.ts` | API-key slash command now only opens a modal after `canUpdateServerSettings`; modal submission re-checks the same authorization before storage. Smoke tests cover unauthorized denial and authorized modal/storage flow. Server tests passed. |
| `3228255435` | `resolveUserTtsPreset` accepted a stored voice preset whose model was disallowed by guild policy. | Task 1 | `apps/server/src/commands/tts/runtime-cache.ts`, `apps/server/src/commands/tts/runtime-cache.test.ts` | `resolveUserTtsPreset` now returns a stored preset only when its model is included in `runtime.allowedModels`; otherwise it falls back through the sanitized model resolver/default preset. Runtime-cache tests cover disallowed voice fallback. Server tests passed. |
| `3228255440` | Auto-read forwarded every guild message to TTS without checking the joined/bound text context. | Task 5 | `apps/server/src/bot/message-reader.ts`, `apps/server/src/bot/message-reader.test.ts`, `apps/server/src/commands/tts/join.ts` | Message reader now loads the bound text channel by `guildId` and voice channel and only enqueues when `boundTextChannelId === message.channelId`; tests cover wrong text channel and wrong guild not enqueueing. Server tests passed. |
| `3230871612` | `/tts join` left the bot connected if text-channel binding failed after a successful voice join. | Task 6 | `apps/server/src/commands/tts/join.ts`, `apps/server/src/commands/tts/join.test.ts` | Join handler tracks successful voice connection and calls `leaveVoice(guild.id)` when subsequent binding/invalidation fails; join tests assert failure reply, logged error, and rollback call. Server tests passed. |
| `3230871614` | New settings flow replied with raw English literals instead of i18n message keys. | Task 4 | `apps/server/src/commands/tts/settings/index.ts`, `packages/i18n/messages/en.json`, `packages/i18n/messages/ja.json`, `packages/i18n/messages/ko.json`, `apps/server/src/smoke.test.ts` | Settings unknown-command, guild-only, voice picker, selected marker/success, modal labels, unauthorized, and API-key success replies now use `@to-much-talker/i18n` message keys in all three locale files. Server tests and full turbo verification passed. |
| `3230871618` | Voice button handler saved and confirmed disallowed presets, causing runtime fallback mismatch. | Task 4 | `apps/server/src/commands/tts/settings/index.ts`, `apps/server/src/smoke.test.ts` | Voice picker filters buttons with `allowedVoicePresets(modelSettings)`, and button submission revalidates the selected preset against current guild model settings before saving. Smoke tests assert disallowed selection replies ephemerally and does not write settings/audit rows. Server tests passed. |
| `3230871620` | User voice writes were keyed only by `userId`, causing cross-guild preference bleed. | Task 2 | `packages/db/src/sqlite/schema.ts`, `packages/db/src/pg/schema.ts`, SQLite/Postgres migration snapshots/sql, `apps/server/src/commands/tts/settings/index.ts`, `apps/server/src/commands/tts/runtime-cache.ts`, `apps/server/src/commands/tts/runtime-cache.test.ts` | `user_settings` now has composite primary key `(guild_id, user_id)` in both dialects and migrations. Runtime/settings reads and writes filter/upsert by both guild and user. Runtime tests cover distinct per-guild preferences for the same user. Server/db tests passed. |
| `3230871623` | Migration directory resolution ran at module import and could fail runtime imports. | Task 7 | `packages/db/src/migrate.ts`, `packages/db/src/migrate.test.ts` | `resolveMigrationsDir()` is now called inside the SQLite/Postgres branches of `runMigrations()`; migration tests assert importing the module succeeds when migration dirs are unavailable and execution throws only when migrations run. DB tests passed 3 files/11 tests. |
| `3230871626` | Guild API-key decryption ignored the stored `apiKeyVersion` after key rotation. | Task 1 | `apps/server/src/commands/tts/runtime-cache.ts`, `apps/server/src/commands/tts/runtime-cache.test.ts` | `loadGuildApiKey` now builds a `KeyRing` from the configured current master-key version and decrypts only when the row's stored version has a matching key. Tests cover matching stored/current key-version success plus missing or wrong stored-version key failures without poisoning the runtime cache. Server tests passed. |
| `3230871628` | Server API keys were collected through a slash command string option. | Task 3 | `apps/server/src/bot/commands-registry.ts`, `apps/server/src/commands/index.ts`, `apps/server/src/bot/router.ts`, `apps/server/src/commands/tts/settings/index.ts`, `apps/server/src/smoke.test.ts` | `/tts settings api-key` no longer registers a string `key` option; it opens a Discord modal registered through `InteractionRouter.registerModal`, and modal submit stores the secret only after reauthorization. Smoke tests assert command JSON has no `key` option and modal flow succeeds. Server tests passed. |

## Verification

- `lsp_diagnostics` on `apps/server/src`: 44 TypeScript files scanned, 0 files with errors, 18 informational diagnostics.
- `lsp_diagnostics` on `packages/db/src`: 12 TypeScript files scanned, 0 files with errors, 2 informational diagnostics.
- `yarn workspace @to-much-talker/server test`: passed, 5 test files and 41 tests. Known non-fatal Vite `@openrouter/sdk` source-map warnings appeared.
- `yarn workspace @to-much-talker/db test`: passed, 3 test files and 11 tests.
- `yarn turbo run lint typecheck test build`: passed, 29 successful tasks out of 29 total. Raw command output is recorded in `task-8-full-verification.txt`.

## PR Checks

`gh pr checks --watch=false` was inspected after local verification. GitHub reported the current remote PR head checks passing except the expected skipped `Merge manifest (${{ matrix.image }})` job. The working tree still contains uncommitted/unpushed Task 8 evidence and prior task changes, so these PR checks do not prove the current local working-tree state; they reflect the remote PR head only until Atlas commits and pushes the local changes. Local verification above remains the proof for this working tree.

## Secret Handling

Evidence includes no plaintext API keys. Tests and descriptions use only dummy/redacted values.
