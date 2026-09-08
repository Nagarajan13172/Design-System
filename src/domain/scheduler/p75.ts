import type { ItemKind } from '@content/types'

/**
 * `deriveRating` compares latency against the LEARNER'S OWN rolling p75 for that
 * item kind, not against a constant: "fast" for a cloze is nothing like "fast" for
 * an architecture-build, and a constant would systematically mis-rate one of them.
 *
 * Authored defaults seed it until a learner has enough history of their own.
 */
export const DEFAULT_P75_MS: Record<ItemKind, number> = {
  predict: 45_000, 'mcq-rationale': 30_000, 'constraint-flip': 40_000,
  'spot-the-failure': 35_000, 'code-cloze': 50_000, 'code-diff': 45_000,
  'architecture-build': 240_000, estimation: 60_000,
  cloze: 15_000, 'claim-recall': 12_000, 'order-steps': 45_000,
  'free-recall': 90_000, 'tradeoff-defense': 240_000, 'requirements-triage': 90_000,
}

const MIN_SAMPLES = 8

export function rollingP75(latencies: number[], kind: ItemKind): number {
  if (latencies.length < MIN_SAMPLES) return DEFAULT_P75_MS[kind]
  const s = [...latencies].sort((a, b) => a - b)
  const i = (s.length - 1) * 0.75
  const lo = Math.floor(i), hi = Math.ceil(i)
  return lo === hi ? s[lo]! : s[lo]! + (s[hi]! - s[lo]!) * (i - lo)
}
