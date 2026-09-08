import { fsrs, generatorParameters, createEmptyCard, State, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import type { DerivedRating } from '../grading/types'
import type { CardRow, FsrsState } from '@/data/repo/schema'
import type { ClaimId, ModuleId } from '@content/types'

/**
 * ADR-7: THE ONLY PLACE `ts-fsrs` IS IMPORTED. ESLint enforces it.
 *
 * Behind `interface Scheduler`, with every review storing a full pre/post card
 * snapshot — which is what makes the algorithm swappable later without discarding
 * a day of history. Hand-rolling FSRS is explicitly out of scope; so is reaching
 * into its internals.
 */

export interface SchedulerConfig {
  requestRetention: number
  maximumInterval: number
  enableFuzz: boolean
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  requestRetention: 0.9,
  maximumInterval: 1095,
  enableFuzz: true,
}

export interface Scheduler {
  init(claimId: ClaimId, moduleId: ModuleId, now: number): CardRow
  next(card: CardRow, rating: DerivedRating, now: number): { card: CardRow; scheduledDays: number }
  /** How many cards come due per day over the next `days`. Feeds the review forecast. */
  forecast(cards: CardRow[], now: number, days: number): number[]
}

const toFsrs = (c: CardRow): FsrsCard => ({
  due: new Date(c.due),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state as unknown as State,
  last_review: c.last_review ? new Date(c.last_review) : undefined,
})

const fromFsrs = (id: ClaimId, moduleId: ModuleId, f: FsrsCard, status: CardRow['status']): CardRow => ({
  id, moduleId, status,
  due: f.due.getTime(),
  stability: f.stability,
  difficulty: f.difficulty,
  elapsed_days: f.elapsed_days,
  scheduled_days: f.scheduled_days,
  reps: f.reps,
  lapses: f.lapses,
  state: f.state as unknown as FsrsState,
  last_review: f.last_review ? f.last_review.getTime() : null,
})

export function createScheduler(config: SchedulerConfig = DEFAULT_CONFIG): Scheduler {
  const f = fsrs(generatorParameters({
    request_retention: config.requestRetention,
    maximum_interval: config.maximumInterval,
    enable_fuzz: config.enableFuzz,
    enable_short_term: true,
  }))

  return {
    init(claimId, moduleId, now) {
      return fromFsrs(claimId, moduleId, createEmptyCard(new Date(now)), 'active')
    },

    next(card, rating, now) {
      // DerivedRating is 1..4, which is exactly ts-fsrs' Grade (Again..Easy).
      // The brand exists to gate what may PRODUCE a rating, not to change its shape.
      const out = f.next(toFsrs(card), new Date(now), rating as unknown as Grade)
      const post = fromFsrs(card.id, card.moduleId, out.card, card.status)
      return { card: post, scheduledDays: post.scheduled_days }
    },

    forecast(cards, now, days) {
      const buckets = new Array(days).fill(0) as number[]
      for (const c of cards) {
        if (c.status !== 'active') continue
        const d = Math.floor((c.due - now) / 86_400_000)
        if (d >= 0 && d < days) buckets[d]! += 1
        else if (d < 0) buckets[0]! += 1   // overdue lands on today
      }
      return buckets
    },
  }
}
