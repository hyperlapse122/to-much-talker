import type { QueueStrategyName } from '@to-much-talker/shared'
import { dropNewestStrategy } from './strategies/drop-newest.js'
import { dropOldestStrategy } from './strategies/drop-oldest.js'
import { interruptStrategy } from './strategies/interrupt.js'
import type { QueueStrategy } from './types.js'

const STRATEGY_REGISTRY = new Map<QueueStrategyName, QueueStrategy>([
  ['drop-oldest', dropOldestStrategy],
  ['drop-newest', dropNewestStrategy],
  ['interrupt', interruptStrategy],
])

export function getStrategy(name: QueueStrategyName): QueueStrategy {
  const strategy = STRATEGY_REGISTRY.get(name)
  if (strategy === undefined) {
    throw new Error(`Unknown queue strategy: ${name}`)
  }
  return strategy
}

export function registerStrategy(name: QueueStrategyName, strategy: QueueStrategy): void {
  STRATEGY_REGISTRY.set(name, strategy)
}
