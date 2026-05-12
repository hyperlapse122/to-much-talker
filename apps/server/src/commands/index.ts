import type { InteractionRouter } from '../bot/router.js'
import type { CommandContext } from './context.js'
import { handleTtsClear } from './tts/clear.js'
import { handleTtsHelp } from './tts/help.js'
import { handleTtsJoin } from './tts/join.js'
import { handleTtsLeave } from './tts/leave.js'
import { handleTtsSay } from './tts/say.js'
import { handleTtsModelButton, handleTtsSettings, TTS_MODEL_BUTTON_IDS } from './tts/settings/index.js'
import { handleTtsSetup } from './tts/setup.js'
import { handleTtsSkip } from './tts/skip.js'
import { handleTtsStats } from './tts/stats.js'

export type { CommandContext } from './context.js'

/**
 * Register every `/tts <sub>` handler against the shared `InteractionRouter`.
 *
 * The router's per-handler error trapping (see `bot/router.ts`) guarantees a
 * reply, so individual handlers may throw without timing out the interaction.
 */
export function registerCommandHandlers(router: InteractionRouter, ctx: CommandContext): void {
  router.register('tts', 'join', (i) => handleTtsJoin(i, ctx))
  router.register('tts', 'leave', (i) => handleTtsLeave(i, ctx))
  router.register('tts', 'skip', (i) => handleTtsSkip(i, ctx))
  router.register('tts', 'clear', (i) => handleTtsClear(i, ctx))
  router.register('tts', 'say', (i) => handleTtsSay(i, ctx))
  router.register('tts', 'stats', (i) => handleTtsStats(i, ctx))
  router.register('tts', 'help', (i) => handleTtsHelp(i, ctx))
  router.register('tts', 'api-key', (i) => handleTtsSettings(i, ctx))
  router.register('tts', 'model', (i) => handleTtsSettings(i, ctx))
  for (const buttonId of TTS_MODEL_BUTTON_IDS) {
    router.registerButton(buttonId, (i) => handleTtsModelButton(i, ctx))
  }
  router.register('tts', 'setup', (i) => handleTtsSetup(i, ctx))
}
