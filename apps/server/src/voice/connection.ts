import type { VoiceConnection } from '@discordjs/voice'
import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import type { Guild, StageChannel, VoiceChannel } from 'discord.js'
import { logger } from '../logger.js'

const log = logger.child({ component: 'voice/connection' })
const RECONNECT_TIMEOUT = 5_000

export async function joinVoice(
  guild: Guild,
  channel: VoiceChannel | StageChannel,
): Promise<VoiceConnection> {
  const existing = getVoiceConnection(guild.id)

  if (existing !== undefined && existing.joinConfig.channelId === channel.id) {
    log.info({ guildId: guild.id, channelId: channel.id }, 'Reusing existing voice connection')
    return existing
  }

  if (existing !== undefined) {
    log.info(
      {
        guildId: guild.id,
        previousChannelId: existing.joinConfig.channelId,
        nextChannelId: channel.id,
      },
      'Destroying previous voice connection before join',
    )
    existing.destroy()
  }

  log.info({ guildId: guild.id, channelId: channel.id }, 'Joining voice channel')
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  })

  connection.on(VoiceConnectionStatus.Ready, () => {
    log.info({ guildId: guild.id, channelId: channel.id }, 'Voice connection ready')
  })

  connection.on(VoiceConnectionStatus.Connecting, () => {
    log.debug({ guildId: guild.id, channelId: channel.id }, 'Voice connection connecting')
  })

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    void handleDisconnect(connection, guild.id)
  })

  return connection
}

export function leaveVoice(guildId: string): void {
  const connection = getVoiceConnection(guildId)

  if (connection !== undefined) {
    log.info({ guildId, channelId: connection.joinConfig.channelId }, 'Leaving voice channel')
    connection.destroy()
  }
}

async function handleDisconnect(connection: VoiceConnection, guildId: string): Promise<void> {
  try {
    await Promise.race([
      entersState(connection, VoiceConnectionStatus.Signalling, RECONNECT_TIMEOUT),
      entersState(connection, VoiceConnectionStatus.Connecting, RECONNECT_TIMEOUT),
    ])
  } catch (error) {
    log.warn({ guildId, error }, 'Voice connection permanently disconnected')
    connection.destroy()
  }
}
