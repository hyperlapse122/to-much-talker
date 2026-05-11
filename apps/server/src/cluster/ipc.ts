import type { IpcTransport } from '@to-much-talker/settings-core'
import { logger } from '../logger.js'

const log = logger.child({ component: 'cluster/ipc' })

export type IpcMessage =
  | { type: 'settings:invalidate'; payload: { guildId: string } }
  | { type: 'reload' }
  | { type: 'shutdown' }

export class HybridShardingIpcTransport implements IpcTransport {
  readonly #invalidateHandlers: ((guildId: string) => void)[] = []
  #listening = false

  async broadcastInvalidate(guildId: string): Promise<void> {
    const msg: IpcMessage = { type: 'settings:invalidate', payload: { guildId } }

    try {
      if (typeof process.send === 'function') {
        process.send(msg)
      }
      log.debug({ guildId }, 'Broadcast settings:invalidate')
    } catch (error) {
      log.error({ error, guildId }, 'Failed to broadcast settings:invalidate')
    }
  }

  onInvalidate(handler: (guildId: string) => void): void {
    this.#invalidateHandlers.push(handler)

    if (this.#listening) return
    this.#listening = true

    process.on('message', (raw: unknown) => {
      if (!isIpcMessage(raw)) return
      if (raw.type !== 'settings:invalidate') return

      log.debug({ guildId: raw.payload.guildId }, 'Received settings:invalidate IPC')
      for (const invalidate of this.#invalidateHandlers) {
        invalidate(raw.payload.guildId)
      }
    })
  }
}

export function isIpcMessage(msg: unknown): msg is IpcMessage {
  if (typeof msg !== 'object' || msg === null) return false

  const maybeMessage = msg as Record<string, unknown>
  const type = maybeMessage.type
  if (type === 'settings:invalidate') {
    const payload = maybeMessage.payload
    if (typeof payload !== 'object' || payload === null) return false
    return typeof (payload as Record<string, unknown>).guildId === 'string'
  }

  return type === 'reload' || type === 'shutdown'
}
