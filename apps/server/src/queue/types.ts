import type { ChannelId, UserId } from '@to-much-talker/shared'

export interface QueuedItem {
  readonly id: string
  readonly text: string
  readonly userId: UserId
  readonly channelId: ChannelId
  readonly addedAt: number
  readonly estCostMicros: number
  readonly model: string
  readonly voice?: string
}

export interface EnqueueResult {
  readonly accepted: boolean
  readonly evicted: QueuedItem[]
}

export interface QueueStrategy {
  readonly name: string
  enqueue(item: QueuedItem, queue: QueuedItem[], cap: number): EnqueueResult
}
