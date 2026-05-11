import { buildLocalizations } from '@to-much-talker/i18n'
import type { Locale, LocalizationPayload } from '@to-much-talker/i18n'

/**
 * Build Discord localization payload for a command name and description.
 *
 * Why static maps instead of Paraglide runtime messages?
 * --------------------------------------------------------
 * Slash commands are registered against Discord's REST API ONCE per deploy
 * (see commands-registry.ts), not per-interaction. At deploy time we do not
 * want to depend on compiled Paraglide output (`src/paraglide/`) being
 * present — that directory is gitignored and only materializes after
 * `yarn workspace @to-much-talker/i18n compile`. Static maps make command
 * registration deterministic and decoupled from Paraglide's build state.
 *
 * Runtime user-facing strings (replies, embeds) still go through Paraglide.
 */
export function buildCommandLocalizations(
  nameByLocale: Record<Locale, string>,
  descByLocale: Record<Locale, string>,
): LocalizationPayload {
  return buildLocalizations(nameByLocale, descByLocale)
}
