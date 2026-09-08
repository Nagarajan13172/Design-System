import type { CardRow } from '@/data/repo/schema'
import type { ItemKind, ModuleId } from '@content/types'
import { DEFAULT_P75_MS } from './p75'

/**
 * THE DUE QUEUE.
 *
 * Budgeted in SECONDS, not in cards. "20 cards" means nothing to someone with seven
 * minutes; a session that runs long gets abandoned mid-way, which is worse than a
 * short one, because the abandoned cards were already shown.
 *
 * Then the interleave repair pass. A roadmap is a blocked-practice machine — its
 * whole affordance is "finish this domain, then the next" — and blocked practice
 * inflates in-session performance while depressing transfer. Interleaving has to be
 * imposed by the queue, because nothing else in the product will impose it.
 */

export interface QueueItem {
  cardId: string
  moduleId: ModuleId
  domain: string
  itemKind: ItemKind
  /** Expected seconds, from the learner's p75 for that kind. */
  estSeconds: number
  overdueDays: number
  isNew: boolean
}

export interface QueueOptions {
  budgetSeconds: number
  /** Cards from the module the learner just finished, to avoid opening on them. */
  previousModuleId?: ModuleId | null
  maxNewPerSession?: number
}

export const DEFAULT_BUDGET_SECONDS = 420 // seven minutes

/**
 * Composition targets: 60% due review, 25% new, 10% lapsed, 5% ahead-of-schedule.
 * These are targets, not quotas — a queue is not padded with cards that are not due
 * just to hit a ratio.
 */
const MIX = { due: 0.6, fresh: 0.25, lapsed: 0.1, ahead: 0.05 }

export function buildQueue(cards: CardRow[], now: number, opts: QueueOptions, kindFor: (c: CardRow) => ItemKind): QueueItem[] {
  const active = cards.filter(c => c.status === 'active')
  const toItem = (c: CardRow): QueueItem => {
    const itemKind = kindFor(c)
    return {
      cardId: c.id, moduleId: c.moduleId, domain: c.moduleId.split('-')[0]!,
      itemKind, estSeconds: Math.round(DEFAULT_P75_MS[itemKind] / 1000),
      overdueDays: Math.max(0, (now - c.due) / 86_400_000),
      isNew: c.reps === 0,
    }
  }

  const due = active.filter(c => c.due <= now && c.reps > 0 && c.lapses === 0).map(toItem)
  const lapsed = active.filter(c => c.due <= now && c.lapses > 0).map(toItem)
  const fresh = active.filter(c => c.reps === 0).map(toItem)
  const ahead = active.filter(c => c.due > now && c.reps > 0)
    .sort((a, b) => a.due - b.due).map(toItem)

  // Most overdue first within each bucket — those are closest to being forgotten.
  due.sort((a, b) => b.overdueDays - a.overdueDays)
  lapsed.sort((a, b) => b.overdueDays - a.overdueDays)

  const budget = opts.budgetSeconds
  const picked: QueueItem[] = []
  let spent = 0
  const take = (pool: QueueItem[], share: number, cap?: number) => {
    const allowance = budget * share
    let used = 0, n = 0
    for (const it of pool) {
      if (cap != null && n >= cap) break
      if (used + it.estSeconds > allowance) break
      if (spent + it.estSeconds > budget) break
      picked.push(it); used += it.estSeconds; spent += it.estSeconds; n++
    }
  }
  take(lapsed, MIX.lapsed)
  take(due, MIX.due)
  take(fresh, MIX.fresh, opts.maxNewPerSession ?? 10)
  take(ahead, MIX.ahead)
  // Anything left in the budget goes to due cards — the budget is the constraint,
  // the mix is a target.
  take(due.filter(d => !picked.includes(d)), 1)

  return interleave(picked, opts.previousModuleId ?? null)
}

/**
 * INTERLEAVE REPAIR.
 *
 * Constraints:
 *   - no two consecutive items from the same MODULE
 *   - no three consecutive from the same DOMAIN
 *   - the first item is never from the module the learner just finished
 *
 * A greedy repair rather than a shuffle: a shuffle satisfies the constraints only
 * on average, and "on average" is not a property you can assert in a test.
 */
export function interleave(items: QueueItem[], previousModuleId: ModuleId | null): QueueItem[] {
  const pool = [...items]
  const out: QueueItem[] = []

  const ok = (it: QueueItem) => {
    const n = out.length
    if (n === 0) return it.moduleId !== previousModuleId
    if (out[n - 1]!.moduleId === it.moduleId) return false
    if (n >= 2 && out[n - 1]!.domain === it.domain && out[n - 2]!.domain === it.domain) return false
    return true
  }

  while (pool.length) {
    let i = pool.findIndex(ok)
    // No candidate satisfies every constraint: relax the FIRST-item rule before the
    // adjacency rules, because opening on the previous module is a smaller harm than
    // two of the same module back to back.
    if (i === -1) i = pool.findIndex(it => out.length === 0 || out[out.length - 1]!.moduleId !== it.moduleId)
    if (i === -1) i = 0
    out.push(pool.splice(i, 1)[0]!)
  }
  return out
}

/** For the deck: what the learner is told before starting. */
export function queueSummary(q: QueueItem[]) {
  const domains = new Map<string, number>()
  for (const it of q) domains.set(it.domain, (domains.get(it.domain) ?? 0) + 1)
  return {
    count: q.length,
    estSeconds: q.reduce((s, i) => s + i.estSeconds, 0),
    domains: [...domains.entries()].sort((a, b) => b[1] - a[1]),
    newCount: q.filter(i => i.isNew).length,
  }
}
