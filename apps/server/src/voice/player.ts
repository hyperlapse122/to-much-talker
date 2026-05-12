import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import {
  AudioPlayerStatus,
  createAudioPlayer,
  VoiceConnectionStatus,
  type AudioPlayer,
  type AudioResource,
  type VoiceConnection,
} from '@discordjs/voice'
import { logger } from '../logger.js'
import type { AudioInputFormat } from './pipeline.js'
import { createAudioStream } from './pipeline.js'
import { createAudioResourceFromBuffer } from './resource.js'

const log = logger.child({ component: 'voice/player' })
const PLAYBACK_GRACE_MS = 10_000
const ESTIMATED_BYTES_PER_SECOND = 16_000
const STREAM_PLAYBACK_TIMEOUT_MS = 120_000

export type PlayerState = 'idle' | 'playing' | 'paused' | 'stopped'

export interface PlayerEvents {
  start: []
  idle: []
  error: [error: Error]
}

export class Player extends EventEmitter<PlayerEvents> {
  readonly #guildId: string
  readonly #audioPlayer: AudioPlayer
  #connection: VoiceConnection | null = null
  #state: PlayerState = 'idle'
  #playbackTimeout: ReturnType<typeof setTimeout> | null = null

  public constructor(guildId: string) {
    super()
    this.#guildId = guildId
    this.#audioPlayer = createAudioPlayer()

    this.#audioPlayer.on(AudioPlayerStatus.Playing, () => {
      this.#state = 'playing'
      this.emit('start')
      log.debug({ guildId: this.#guildId }, 'Audio started playing')
    })

    this.#audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.#clearTimeout()

      // ALWAYS emit 'idle' on the AudioPlayer's Idle status — including
      // stop-driven transitions from stop()/skip()/timeout. `playFromBuffer()`
      // awaits `#waitForCompletion()` which only resolves on 'idle' or 'error',
      // so suppressing the emit when state === 'stopped' would hang the
      // awaiter indefinitely and stall the per-guild playback queue.
      const wasStopped = this.#state === 'stopped'
      this.#state = 'idle'
      this.emit('idle')
      log.debug({ guildId: this.#guildId, wasStopped }, 'Audio player idle')
    })

    this.#audioPlayer.on('error', (error) => {
      this.#clearTimeout()
      this.#state = 'idle'
      this.emit('error', error)
      log.error({ guildId: this.#guildId, error: error.message }, 'Audio player error')
    })
  }

  public attachConnection(connection: VoiceConnection): void {
    this.#connection = connection
    connection.subscribe(this.#audioPlayer)

    connection.on(VoiceConnectionStatus.Connecting, () => {
      this.#connection?.subscribe(this.#audioPlayer)
    })
  }

  public async playFromBuffer(buf: Buffer, format: AudioInputFormat): Promise<void> {
    const playbackTimeoutMs = PLAYBACK_GRACE_MS + (buf.length / ESTIMATED_BYTES_PER_SECOND) * 1_000
    await this.playFromReadable(Readable.from([buf]), format, playbackTimeoutMs)
  }

  public async playFromWebStream(
    stream: ReadableStream<Uint8Array>,
    format: AudioInputFormat,
    playbackTimeoutMs = STREAM_PLAYBACK_TIMEOUT_MS,
  ): Promise<void> {
    await this.playFromReadable(Readable.from(readWebStream(stream)), format, playbackTimeoutMs)
  }

  public async playFromReadable(
    stream: Readable,
    format: AudioInputFormat,
    playbackTimeoutMs = STREAM_PLAYBACK_TIMEOUT_MS,
  ): Promise<void> {
    const onInputError = (error: Error): void => {
      this.#audioPlayer.emit('error', error)
    }
    stream.on('error', onInputError)

    const audioInfo = createAudioStream(stream, format)
    const resource: AudioResource = createAudioResourceFromBuffer(audioInfo)

    this.#clearTimeout()
    this.#playbackTimeout = setTimeout(() => {
      log.warn({ guildId: this.#guildId }, 'Playback timeout exceeded, stopping')
      this.stop()
    }, playbackTimeoutMs)

    try {
      this.#audioPlayer.play(resource)
      await this.#waitForCompletion()
    } finally {
      stream.off('error', onInputError)
      audioInfo.cleanup()
    }
  }

  public stop(): void {
    this.#clearTimeout()
    this.#state = 'stopped'
    this.#audioPlayer.stop(true)
  }

  public skip(): void {
    this.stop()
  }

  public pause(): boolean {
    if (this.#state !== 'playing') {
      return false
    }

    this.#state = 'paused'
    return this.#audioPlayer.pause()
  }

  public resume(): boolean {
    if (this.#state !== 'paused') {
      return false
    }

    this.#state = 'playing'
    return this.#audioPlayer.unpause()
  }

  public getState(): PlayerState {
    return this.#state
  }

  public get guildId(): string {
    return this.#guildId
  }

  #clearTimeout(): void {
    if (this.#playbackTimeout !== null) {
      clearTimeout(this.#playbackTimeout)
      this.#playbackTimeout = null
    }
  }

  async #waitForCompletion(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        this.off('idle', onIdle)
        this.off('error', onError)
      }
      const onIdle = (): void => {
        cleanup()
        resolve()
      }
      const onError = (error: Error): void => {
        cleanup()
        reject(error)
      }

      this.once('idle', onIdle)
      this.once('error', onError)
    })
  }
}

async function* readWebStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) return
      yield result.value
    }
  } finally {
    reader.releaseLock()
  }
}

const playerRegistry = new Map<string, Player>()

export function getOrCreatePlayer(guildId: string): Player {
  let player = playerRegistry.get(guildId)

  if (player === undefined) {
    player = new Player(guildId)
    playerRegistry.set(guildId, player)
  }

  return player
}

export function removePlayer(guildId: string): void {
  const player = playerRegistry.get(guildId)

  if (player !== undefined) {
    player.stop()
    playerRegistry.delete(guildId)
  }
}
