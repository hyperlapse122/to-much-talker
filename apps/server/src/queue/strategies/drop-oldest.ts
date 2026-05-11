import type { EnqueueResult, QueuedItem, QueueStrategy } from '../types.js'

export const dropOldestStrategy: QueueStrategy = {
  name: 'drop-oldest',
  enqueue(item: QueuedItem, queue: QueuedItem[], cap: number): EnqueueResult {
    if (cap <= 0) {
      return { accepted: false, evicted: [] }
    }

    if (queue.length < cap) {
      queue.push(item)
      return { accepted: true, evicted: [] }
    }

    const evicted = queue.shift()
    queue.push(item)
    return { accepted: true, evicted: evicted !== undefined ? [evicted] : [] }
  },
}
