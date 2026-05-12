import { EventEmitter } from 'node:events'
import type { Client, VoiceState } from 'discord.js'
import { logger } from '../logger.js'

const log = logger.child({ component: 'voice/idle' })

const GRACE_MS = 5_000 // 5 seconds grace for humans returning

export interface IdleWatcherOptions {
  readonly guildId: string
  readonly voiceChannelId: string
  readonly textChannelId: string
  readonly idleTextInactivityMs: number // from settings
  readonly botUserId: string
  readonly onLeave: () => Promise<void> // callback to actually leave
}

export interface IdleWatcherEvents {
  'idle-leave': [reason: 'text-inactivity' | 'voice-empty']
}

export class IdleWatcher extends EventEmitter<IdleWatcherEvents> {
  readonly #opts: IdleWatcherOptions
  readonly #client: Client
  #textInactivityTimer: ReturnType<typeof setTimeout> | null = null
  #voiceEmptyTimer: ReturnType<typeof setTimeout> | null = null
  #destroyed = false

  constructor(opts: IdleWatcherOptions, client: Client) {
    super()
    this.#opts = opts
    this.#client = client

    // Start text inactivity timer
    this.#resetTextTimer()

    // Listen for voice state changes
    this.#client.on('voiceStateUpdate', this.#onVoiceStateUpdate)

    log.debug(
      {
        guildId: opts.guildId,
        voiceChannelId: opts.voiceChannelId,
        idleMs: opts.idleTextInactivityMs,
      },
      'IdleWatcher started',
    )
  }

  // Call this each time TTS audio is played to reset the text inactivity timer
  resetTextActivity(): void {
    if (this.#destroyed) return
    this.#resetTextTimer()
  }

  #resetTextTimer(): void {
    if (this.#textInactivityTimer !== null) {
      clearTimeout(this.#textInactivityTimer)
    }
    this.#textInactivityTimer = setTimeout(() => {
      if (!this.#destroyed) {
        log.info({ guildId: this.#opts.guildId }, 'Text inactivity timeout — leaving voice channel')
        void this.#triggerLeave('text-inactivity')
      }
    }, this.#opts.idleTextInactivityMs)
  }

  readonly #onVoiceStateUpdate = (oldState: VoiceState, newState: VoiceState): void => {
    // Only care about our guild
    if (oldState.guild.id !== this.#opts.guildId && newState.guild.id !== this.#opts.guildId) {
      return
    }

    // Handle bot being moved to another channel
    if (
      oldState.member?.id === this.#opts.botUserId &&
      newState.channelId !== null &&
      newState.channelId !== this.#opts.voiceChannelId
    ) {
      log.info(
        { guildId: this.#opts.guildId, newChannelId: newState.channelId },
        'Bot moved to different channel — reattaching',
      )
      // Note: Actual reattach logic would be handled by the caller (Task 17/19)
      // IdleWatcher just emits the event for logging
    }

    // Check if our voice channel is now empty of humans
    this.#checkVoiceEmpty()
  }

  #checkVoiceEmpty(): void {
    if (this.#destroyed) return

    const guild = this.#client.guilds.cache.get(this.#opts.guildId)
    if (guild === undefined) return

    const channel = guild.channels.cache.get(this.#opts.voiceChannelId)
    if (channel === undefined || !channel.isVoiceBased()) return

    // Count humans (non-bot members) in the channel
    const humanCount = channel.members.filter((m) => !m.user.bot).size

    if (humanCount === 0) {
      // Start grace timer if not already running
      if (this.#voiceEmptyTimer === null) {
        log.debug({ guildId: this.#opts.guildId }, 'Voice channel empty — starting grace timer')
        this.#voiceEmptyTimer = setTimeout(() => {
          if (!this.#destroyed) {
            log.info({ guildId: this.#opts.guildId }, 'Voice channel empty after grace — leaving')
            void this.#triggerLeave('voice-empty')
          }
        }, GRACE_MS)
      }
    } else {
      // Humans present — cancel grace timer
      if (this.#voiceEmptyTimer !== null) {
        log.debug({ guildId: this.#opts.guildId }, 'Humans returned — cancelling grace timer')
        clearTimeout(this.#voiceEmptyTimer)
        this.#voiceEmptyTimer = null
      }
    }
  }

  async #triggerLeave(reason: 'text-inactivity' | 'voice-empty'): Promise<void> {
    if (this.#destroyed) return
    this.destroy()

    try {
      await this.#opts.onLeave()
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error during idle leave',
      )
    }

    this.emit('idle-leave', reason)
  }

  destroy(): void {
    if (this.#destroyed) return
    this.#destroyed = true

    if (this.#textInactivityTimer !== null) {
      clearTimeout(this.#textInactivityTimer)
      this.#textInactivityTimer = null
    }
    if (this.#voiceEmptyTimer !== null) {
      clearTimeout(this.#voiceEmptyTimer)
      this.#voiceEmptyTimer = null
    }

    this.#client.off('voiceStateUpdate', this.#onVoiceStateUpdate)

    log.debug({ guildId: this.#opts.guildId }, 'IdleWatcher destroyed')
  }
}

// Per-guild watcher registry
const watcherRegistry = new Map<string, IdleWatcher>()

export function startIdleWatcher(opts: IdleWatcherOptions, client: Client): IdleWatcher {
  // Stop existing watcher for this guild if any
  stopIdleWatcher(opts.guildId)

  const watcher = new IdleWatcher(opts, client)
  watcherRegistry.set(opts.guildId, watcher)
  return watcher
}

export function stopIdleWatcher(guildId: string): void {
  const watcher = watcherRegistry.get(guildId)
  if (watcher !== undefined) {
    watcher.destroy()
    watcherRegistry.delete(guildId)
  }
}

export function getIdleWatcher(guildId: string): IdleWatcher | undefined {
  return watcherRegistry.get(guildId)
}
