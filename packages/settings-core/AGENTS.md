# AGENTS — @to-much-talker/settings-core

This package owns ALL settings resolution semantics. It is the SOLE authority on how user/channel/server settings combine.

## Core Rules

- NEVER duplicate clamping logic in `apps/server` — always go through `resolveSettings()`
- NO DB writes here — this package is READ-ONLY; writes happen in slash command handlers
- NO discord.js imports — this package must be free of Discord-specific dependencies
- Cache invalidation MUST happen after any settings write in the command handlers
- The `IpcTransport` interface is pluggable — consumers inject their implementation

## Settings Hierarchy

User ≤ Channel ≤ Server (server settings clamp lower scopes)

```
Server:  max_chars: 200, allowed_models: [A, B]
Channel: max_chars: 300  → clamped to 200
User:    preferred_model: C  → rejected (not in allowed_models)
```

## Cache Usage Pattern

```typescript
// In command handlers
const cached = cache.get({ guildId, channelId, userId })
if (cached) return cached
const resolved = resolveSettings({ server, channel, user })
cache.set({ guildId, channelId, userId }, resolved)

// After settings write
cache.invalidate(guildId)
await ipc.broadcastInvalidate(guildId) // invalidates all worker caches
```

## IPC Transport Implementations

- `apps/server/src/ipc/hybridShardingTransport.ts` (Task 17) — real IPC
- `NoopIpcTransport` — for playground and tests
