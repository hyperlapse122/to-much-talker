import { asChannelId, asUserId } from '@to-much-talker/shared'
import { describe, expect, it } from 'vitest'
import type { QueuedItem } from '../types.js'
import { dropOldestStrategy } from './drop-oldest.js'

function makeItem(id: string): QueuedItem {
  return {
    id,
    text: `Message ${id}`,
    userId: asUserId('123456789012345678'),
    channelId: asChannelId('123456789012345679'),
    addedAt: Date.now(),
    estCostMicros: 100,
    model: 'google/gemini-2.5-flash-preview-tts',
  }
}

describe('drop-oldest strategy', () => {
  it('has expected name', () => {
    expect(dropOldestStrategy.name).toBe('drop-oldest')
  })

  it('accepts item when queue is below cap', () => {
    const queue: QueuedItem[] = []
    const result = dropOldestStrategy.enqueue(makeItem('1'), queue, 5)
    expect(result.accepted).toBe(true)
    expect(result.evicted).toHaveLength(0)
    expect(queue).toHaveLength(1)
  })

  it('evicts oldest when queue is at cap', () => {
    const queue: QueuedItem[] = [makeItem('old')]
    const newItem = makeItem('new')
    const result = dropOldestStrategy.enqueue(newItem, queue, 1)
    expect(result.accepted).toBe(true)
    expect(result.evicted).toHaveLength(1)
    expect(result.evicted[0]?.id).toBe('old')
    expect(queue[0]?.id).toBe('new')
  })

  it('evicts the FIFO oldest with multi-item queue', () => {
    const cap = 3
    const queue: QueuedItem[] = [makeItem('a'), makeItem('b'), makeItem('c')]
    const result = dropOldestStrategy.enqueue(makeItem('d'), queue, cap)
    expect(result.accepted).toBe(true)
    expect(result.evicted[0]?.id).toBe('a')
    expect(queue.map((q) => q.id)).toEqual(['b', 'c', 'd'])
  })

  it('queue never exceeds cap', () => {
    const cap = 3
    const queue: QueuedItem[] = []
    for (let i = 0; i < 10; i++) {
      dropOldestStrategy.enqueue(makeItem(String(i)), queue, cap)
    }
    expect(queue.length).toBeLessThanOrEqual(cap)
  })

  it('rejects when cap is 0', () => {
    const queue: QueuedItem[] = []
    const result = dropOldestStrategy.enqueue(makeItem('1'), queue, 0)
    expect(result.accepted).toBe(false)
    expect(result.evicted).toHaveLength(0)
    expect(queue).toHaveLength(0)
  })

  it('rejects when cap is negative', () => {
    const queue: QueuedItem[] = []
    const result = dropOldestStrategy.enqueue(makeItem('1'), queue, -1)
    expect(result.accepted).toBe(false)
  })
})
