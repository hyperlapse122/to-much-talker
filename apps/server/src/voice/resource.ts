import { createAudioResource, StreamType, type AudioResource } from '@discordjs/voice'
import type { AudioStreamInfo } from './pipeline.js'

export function createAudioResourceFromBuffer(audioInfo: AudioStreamInfo): AudioResource {
  return createAudioResource(audioInfo.stream, {
    inputType: getStreamType(audioInfo.inputType),
    inlineVolume: false,
  })
}

function getStreamType(format: AudioStreamInfo['inputType']): StreamType {
  return format === 'opus' ? StreamType.Opus : StreamType.Arbitrary
}
