# AGENTS — @to-much-talker/shared

This is the **only** package where cross-cutting types, error classes, and branded IDs are defined.
This package contains no I/O — only pure types and helper functions.

## Rules
- NO I/O in this package — no file reads, no network calls, no DB access
- NO default exports — named exports only
- NO business logic — types and pure helper functions only
- NO external dependencies except `zod` (for branded ID schemas)
- All new error types MUST be added here (not in consuming packages)
- All new branded ID types MUST follow the `string & { __brand: 'XxxId' }` pattern
- All helpers MUST have explicit return type annotations

## Branded ID Pattern
```typescript
export type GuildId = string & { readonly __brand: 'GuildId' }
export function asGuildId(s: string): GuildId { ... }
export const GuildIdSchema = z.string().regex(...).transform(s => s as GuildId)
```

## Result Pattern
```typescript
// Never throw across module boundaries
return ok(value)   // { ok: true, value }
return err(error)  // { ok: false, error }
```
