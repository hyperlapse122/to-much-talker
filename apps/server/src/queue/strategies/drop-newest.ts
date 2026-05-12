import type { EnqueueResult, QueuedItem, QueueStrategy } from '../types.js'

export const dropNewestStrategy: QueueStrategy = {
  name: 'drop-newest',
  enqueue(item: QueuedItem, queue: QueuedItem[], cap: number): EnqueueResult {
    if (cap <= 0) {
      return { accepted: false, evicted: [] }
    }

    if (queue.length < cap) {
      queue.push(item)
      return { accepted: true, evicted: [] }
    }

    return { accepted: false, evicted: [] }
  },
}
