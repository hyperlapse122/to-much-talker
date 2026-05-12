import type { EnqueueResult, QueuedItem, QueueStrategy } from '../types.js'

export const interruptStrategy: QueueStrategy = {
  name: 'interrupt',
  enqueue(item: QueuedItem, queue: QueuedItem[], cap: number): EnqueueResult {
    const evicted = [...queue]
    queue.length = 0

    if (cap <= 0) {
      return { accepted: false, evicted }
    }

    queue.push(item)
    return { accepted: true, evicted }
  },
}
