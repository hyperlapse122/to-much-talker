export { LOCALES, DEFAULT_LOCALE } from './locales.js'
export type { Locale } from './locales.js'
export { discordLocaleOf, buildLocalizations } from './discord.js'
export type { LocalizationPayload } from './discord.js'
// Paraglide compiled messages (regenerate via `yarn compile`).
// The compiled output is gitignored — fresh checkouts must run `yarn compile` before typecheck.
export { m } from './paraglide/messages.js'
export { baseLocale, setLocale, locales, getLocale } from './paraglide/runtime.js'
