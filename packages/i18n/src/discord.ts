import type { Locale } from './locales.js'

// Discord's locale codes for our supported languages
const DISCORD_LOCALE_MAP: Record<Locale, string> = {
  en: 'en-US',
  ko: 'ko',
  ja: 'ja',
}

export function discordLocaleOf(locale: Locale): string {
  return DISCORD_LOCALE_MAP[locale]
}

// Type for Discord localization payload
export interface LocalizationPayload {
  name_localizations: Partial<Record<string, string>>
  description_localizations: Partial<Record<string, string>>
}

// Build Discord name_localizations and description_localizations
// from a message key. We manually build these since Paraglide
// generates runtime messages (not static localization objects).
export function buildLocalizations(
  nameByLocale: Record<Locale, string>,
  descriptionByLocale: Record<Locale, string>,
): LocalizationPayload {
  const name_localizations: Partial<Record<string, string>> = {}
  const description_localizations: Partial<Record<string, string>> = {}

  for (const [locale, discordCode] of Object.entries(DISCORD_LOCALE_MAP) as [Locale, string][]) {
    const name = nameByLocale[locale]
    const description = descriptionByLocale[locale]
    if (name !== undefined) {
      name_localizations[discordCode] = name
    }
    if (description !== undefined) {
      description_localizations[discordCode] = description
    }
  }

  return { name_localizations, description_localizations }
}
