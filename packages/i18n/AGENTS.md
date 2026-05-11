# AGENTS — @to-much-talker/i18n

This package provides internationalization for To Much Talker via Paraglide JS.

## Rules
- Every user-facing string MUST be defined in `messages/{locale}.json` — no inline English strings
- NEVER commit the Paraglide compiled output (`src/paraglide/`) — it's gitignored
- Run `yarn workspace @to-much-talker/i18n compile` after changing any message file
- New locales must be added to BOTH `src/locales.ts` AND `project.inlang/settings.json`
- Discord locale code mapping lives in `src/discord.ts` — update it when adding locales
- All 3 locales (en/ko/ja) must have translations for every message key

## Paraglide Project Layout
- `project.inlang/settings.json` — inlang project settings (paraglide-js v1 format requires a directory ending in `.inlang`)
- `messages/{en,ko,ja}.json` — message catalogs (flat key-value with `{paramName}` placeholders)
- `src/paraglide/` — compiled output (gitignored; regenerate with `yarn compile`)

## Adding a New Message
1. Add the key + English text to `messages/en.json`
2. Add translations to `messages/ko.json` and `messages/ja.json`
3. Run `yarn compile` to regenerate `src/paraglide/messages.js`
4. Import via `import { m } from '@to-much-talker/i18n'`

## Locale Codes
- Our codes: `en` | `ko` | `ja`
- Discord codes: `en-US` | `ko` | `ja`
- Mapping: `discordLocaleOf(locale)` in `src/discord.ts`
