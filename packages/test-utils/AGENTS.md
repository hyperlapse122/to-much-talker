# AGENTS — @to-much-talker/test-utils

This package is **ONLY for use in test files**. Never import it in production code.

## Rules

- ONLY import in `**/*.{test,spec}.ts` and `**/test-utils/**` files
- ESLint `no-restricted-imports` rule enforces this (configured in root `eslint.config.js`)
- Mocks are typed via our own interfaces — NOT full discord.js types (Proxy-based approach)
- `openEphemeralDb({dialect:'sqlite'})` returns an in-memory DB for fast tests
- `openEphemeralDb({dialect:'pg'})` requires `RUN_PG_TESTS=1` env var
- All mock builders should return predictable defaults suitable for unit tests

## Mock Pattern

```typescript
const i = mockChatInputInteraction({
  commandName: 'tts',
  subcommand: 'join',
  guildId: '123456789012345678',
})
await handler(i as any) // cast needed to match discord.js types
expectReply(i, (content) => content.ephemeral === true)
```

## Adding a New Fixture

1. Add to the appropriate source file (`discord.ts`, `db.ts`, or `fixtures.ts`)
2. Export from `index.ts`
3. Add a test for the fixture itself if non-trivial
