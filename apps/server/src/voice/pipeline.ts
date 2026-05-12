import { Readable, Transform, type TransformCallback } from 'node:stream'
import opus from '@discordjs/opus'
import prismMedia from 'prism-media'
import { logger } from '../logger.js'

const log = logger.child({ component: 'voice/pipeline' })
const OPUS_RATE = 48_000
const OPUS_CHANNELS = 2
const OPUS_FRAME_SIZE = 960
const OPENROUTER_PCM_RATE = 24_000
const OPENROUTER_PCM_CHANNELS = 1
const PCM_BYTES_PER_SAMPLE = 2
const PCM_FRAME_BYTES = OPUS_FRAME_SIZE * OPUS_CHANNELS * PCM_BYTES_PER_SAMPLE

export type AudioInputFormat = 'mp3' | 'wav' | 'pcm' | 'opus'

export interface AudioStreamInfo {
  readonly stream: Readable
  readonly inputType: 'opus'
  readonly cleanup: () => void
}

export function audioBufferToStream(input: Buffer): Readable {
  return Readable.from([input])
}

export function audioBytesToOpus(input: Buffer, inputFormat: AudioInputFormat): Readable {
  if (inputFormat === 'opus') {
    return audioBufferToStream(input)
  }

  const ffmpeg = createFfmpegDecoder(inputFormat)
  const encoder = new PcmToOpusTransform()

  audioBufferToStream(input).pipe(ffmpeg).pipe(encoder)

  ffmpeg.on('error', (error) => {
    log.error({ error }, 'FFmpeg audio decode failed')
    encoder.destroy(error)
  })

  return encoder
}

export function createAudioStream(input: Buffer, inputFormat: AudioInputFormat): AudioStreamInfo {
  log.debug({ format: inputFormat, bytes: input.length }, 'Creating audio stream')

  const stream = audioBytesToOpus(input, inputFormat)

  return {
    stream,
    inputType: 'opus',
    cleanup() {
      stream.destroy()
    },
  }
}

function createFfmpegDecoder(inputFormat: Exclude<AudioInputFormat, 'opus'>): prismMedia.FFmpeg {
  return new prismMedia.FFmpeg({
    args: [
      ...getInputArgs(inputFormat),
      '-f',
      's16le',
      '-ar',
      String(OPUS_RATE),
      '-ac',
      String(OPUS_CHANNELS),
    ],
  })
}

function getInputArgs(inputFormat: Exclude<AudioInputFormat, 'opus'>): string[] {
  if (inputFormat === 'pcm') {
    return [
      '-f',
      's16le',
      '-ar',
      String(OPENROUTER_PCM_RATE),
      '-ac',
      String(OPENROUTER_PCM_CHANNELS),
      '-i',
      '-',
    ]
  }

  return ['-f', inputFormat, '-i', '-']
}

class PcmToOpusTransform extends Transform {
  readonly #encoder = new opus.OpusEncoder(OPUS_RATE, OPUS_CHANNELS)
  #pending = Buffer.alloc(0)

  public constructor() {
    super({ readableObjectMode: true })
  }

  public override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    try {
      this.#pending = Buffer.concat([this.#pending, chunk])
      this.#pushCompleteFrames()
      callback()
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)))
    }
  }

  public override _flush(callback: TransformCallback): void {
    try {
      if (this.#pending.length > 0) {
        const padding = Buffer.alloc(PCM_FRAME_BYTES - this.#pending.length)
        this.push(this.#encoder.encode(Buffer.concat([this.#pending, padding])))
        this.#pending = Buffer.alloc(0)
      }

      callback()
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)))
    }
  }

  #pushCompleteFrames(): void {
    while (this.#pending.length >= PCM_FRAME_BYTES) {
      const frame = this.#pending.subarray(0, PCM_FRAME_BYTES)
      this.push(this.#encoder.encode(frame))
      this.#pending = this.#pending.subarray(PCM_FRAME_BYTES)
    }
  }
}
