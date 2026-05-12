import type { QueueStrategyName } from '@to-much-talker/shared'
import { logger } from '../logger.js'
import type { Player } from '../voice/player.js'
import { getStrategy } from './registry.js'
import type { QueuedItem } from './types.js'

const log = logger.child({ component: 'queue/manager' })

interface ChannelQueue {
  readonly items: QueuedItem[]
  strategy: QueueStrategyName
  cap: number
  isProcessing: boolean
}

export type ProcessItemFn = (item: QueuedItem) => Promise<void>

export class GuildQueueManager {
  readonly #guildId: string
  readonly #queues = new Map<string, ChannelQueue>()
  readonly #processItem: ProcessItemFn

  public constructor(guildId: string, processItem: ProcessItemFn) {
    this.#guildId = guildId
    this.#processItem = processItem
  }

  #getOrCreateQueue(
    channelId: string,
    strategy: QueueStrategyName = 'drop-oldest',
    cap = 20,
  ): ChannelQueue {
    let queue = this.#queues.get(channelId)
    if (queue === undefined) {
      queue = { items: [], strategy, cap, isProcessing: false }
      this.#queues.set(channelId, queue)
    }
    return queue
  }

  public enqueue(
    item: QueuedItem,
    opts: { strategy?: QueueStrategyName; cap?: number } = {},
  ): { accepted: boolean; evicted: QueuedItem[] } {
    const channelQueue = this.#getOrCreateQueue(
      item.channelId,
      opts.strategy ?? 'drop-oldest',
      opts.cap ?? 20,
    )

    if (opts.strategy !== undefined) channelQueue.strategy = opts.strategy
    if (opts.cap !== undefined) channelQueue.cap = opts.cap

    const strategyImpl = getStrategy(channelQueue.strategy)
    const result = strategyImpl.enqueue(item, channelQueue.items, channelQueue.cap)

    log.debug(
      {
        guildId: this.#guildId,
        channelId: item.channelId,
        accepted: result.accepted,
        evicted: result.evicted.length,
        queueSize: channelQueue.items.length,
      },
      'Item enqueued',
    )

    if (result.accepted && !channelQueue.isProcessing) {
      void this.#processNext(item.channelId)
    }

    return result
  }

  async #processNext(channelId: string): Promise<void> {
    const queue = this.#queues.get(channelId)
    if (queue === undefined || queue.items.length === 0) return

    queue.isProcessing = true
    const item = queue.items.shift()
    if (item === undefined) {
      queue.isProcessing = false
      return
    }

    try {
      await this.#processItem(item)
    } catch (error) {
      log.error(
        {
          guildId: this.#guildId,
          channelId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to process queue item',
      )
    }

    queue.isProcessing = false

    if (queue.items.length > 0) {
      void this.#processNext(channelId)
    }
  }

  public skip(channelId: string): QueuedItem | undefined {
    const queue = this.#queues.get(channelId)
    if (queue === undefined) return undefined
    return queue.items.shift()
  }

  public clear(channelId: string): QueuedItem[] {
    const queue = this.#queues.get(channelId)
    if (queue === undefined) return []
    const cleared = [...queue.items]
    queue.items.length = 0
    return cleared
  }

  public peek(channelId: string): QueuedItem | undefined {
    const queue = this.#queues.get(channelId)
    return queue?.items[0]
  }

  public size(channelId: string): number {
    return this.#queues.get(channelId)?.items.length ?? 0
  }

  public attachPlayer(channelId: string, player: Player): void {
    player.on('idle', () => {
      void this.#processNext(channelId)
    })
  }
}

const managerRegistry = new Map<string, GuildQueueManager>()

export function getOrCreateQueueManager(
  guildId: string,
  processItem: ProcessItemFn,
): GuildQueueManager {
  let manager = managerRegistry.get(guildId)
  if (manager === undefined) {
    manager = new GuildQueueManager(guildId, processItem)
    managerRegistry.set(guildId, manager)
  }
  return manager
}

export function removeQueueManager(guildId: string): void {
  managerRegistry.delete(guildId)
}
