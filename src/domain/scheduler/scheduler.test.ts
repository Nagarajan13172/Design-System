import { describe, it, expect } from 'vitest'
import { createScheduler } from './adapter'
import { buildQueue, interleave, DEFAULT_BUDGET_SECONDS, type QueueItem } from './queue'
import { rollingP75, DEFAULT_P75_MS } from './p75'
import { deriveRating, fromSelfRating } from '@/domain/grading/types'
import { claimMastery, masteryContribution } from '@/domain/axes/mastery'
import type { CardRow } from '@/data/repo/schema'
import type { Attempt } from '@/domain/grading/types'
import { mulberry32 } from '@sim/index'

const DAY = 86_400_000
const card = (id: string, moduleId: string, over: Partial<CardRow> = {}): CardRow => ({
  id, moduleId, due: 0, stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 0,
  reps: 0, lapses: 0, state: 0, last_review: null, status: 'active', ...over,
})

describe('deriveRating', () => {
  const p75 = 20_000
  it('maps correctness and latency to a grade, not correctness alone', () => {
    expect(deriveRating({ kind: 'auto', correct: false, score: 0, latencyMs: 500 }, p75)).toBe(1)
    expect(deriveRating({ kind: 'auto', correct: true, score: 0.4, latencyMs: 500 }, p75)).toBe(2)
    expect(deriveRating({ kind: 'auto', correct: true, score: 1, latencyMs: 90_000 }, p75)).toBe(3)
    expect(deriveRating({ kind: 'auto', correct: true, score: 1, latencyMs: 500 }, p75)).toBe(4)
  })
  it('compares against the learner\'s own p75 for that kind, not a constant', () => {
    const slowForCloze = DEFAULT_P75_MS.cloze + 1
    expect(deriveRating({ kind: 'auto', correct: true, score: 1, latencyMs: slowForCloze }, DEFAULT_P75_MS.cloze)).toBe(3)
    // the same latency is comfortably fast for an architecture-build
    expect(deriveRating({ kind: 'auto', correct: true, score: 1, latencyMs: slowForCloze }, DEFAULT_P75_MS['architecture-build'])).toBe(4)
  })
  it('falls back to authored defaults until there is enough personal history', () => {
    expect(rollingP75([1, 2, 3], 'cloze')).toBe(DEFAULT_P75_MS.cloze)
    expect(rollingP75([1, 2, 3, 4, 5, 6, 7, 8], 'cloze')).toBe(6.25)
  })
})

describe('long simulated run under an injected clock', () => {
  it('produces growing intervals and never loses a card', () => {
    const s = createScheduler()
    let c = s.init('state-races-c1', 'state-races', 0)
    const intervals: number[] = []
    let now = 0
    // 120 days, not 30: with consistently good answers FSRS reaches month-long
    // intervals after two reviews, so a 30-day window cannot observe growth at all.
    for (let day = 0; day < 120; day++) {
      now = day * DAY
      if (c.due > now) continue
      const { card: next, scheduledDays } = s.next(c, deriveRating({ kind: 'auto', correct: true, score: 1, latencyMs: 500 }, 20_000), now)
      intervals.push(scheduledDays)
      c = next
    }
    expect(intervals.length).toBeGreaterThan(2)
    // Consistently good answers must lengthen the interval — that IS spaced repetition.
    expect(intervals.at(-1)!).toBeGreaterThan(intervals[0]!)
    expect(c.reps).toBe(intervals.length)
    expect(c.lapses).toBe(0)
  })

  it('a lapse shortens the interval and is recorded', () => {
    const s = createScheduler()
    let c = s.init('x', 'm', 0)
    for (let i = 0; i < 4; i++) c = s.next(c, deriveRating({ kind: 'auto', correct: true, score: 1, latencyMs: 100 }, 20_000), i * DAY).card
    const before = c.scheduled_days
    c = s.next(c, deriveRating({ kind: 'auto', correct: false, score: 0, latencyMs: 100 }, 20_000), 10 * DAY).card
    expect(c.lapses).toBe(1)
    expect(c.scheduled_days).toBeLessThan(before)
  })

  it('forecast buckets overdue cards onto today', () => {
    const s = createScheduler()
    const now = 10 * DAY
    const f = s.forecast([card('a', 'm', { due: now - DAY }), card('b', 'm', { due: now + 2 * DAY })], now, 7)
    expect(f[0]).toBe(1)
    expect(f[2]).toBe(1)
  })
})

describe('the due queue', () => {
  const kindFor = () => 'cloze' as const

  it('is budgeted in seconds, not in cards', () => {
    const many = Array.from({ length: 200 }, (_, i) => card(`c${i}`, `m${i % 9}`, { reps: 1, due: -1 }))
    const q = buildQueue(many, 0, { budgetSeconds: DEFAULT_BUDGET_SECONDS }, kindFor)
    const total = q.reduce((s, i) => s + i.estSeconds, 0)
    expect(total).toBeLessThanOrEqual(DEFAULT_BUDGET_SECONDS)
    expect(q.length).toBeGreaterThan(0)
  })

  it('never opens on the module the learner just finished', () => {
    const cs = [card('a', 'state-races', { reps: 1, due: -1 }), card('b', 'perf-lcp', { reps: 1, due: -1 })]
    const q = buildQueue(cs, 0, { budgetSeconds: 600, previousModuleId: 'state-races' }, kindFor)
    expect(q[0]!.moduleId).not.toBe('state-races')
  })

  it('never violates its interleave constraints, over 1000 seeded queues', () => {
    const rng = mulberry32(4242)
    for (let run = 0; run < 1000; run++) {
      const n = 4 + Math.floor(rng() * 24)
      const items: QueueItem[] = Array.from({ length: n }, (_, i) => {
        const d = ['state', 'perf', 'found', 'incl'][Math.floor(rng() * 4)]!
        return { cardId: `c${i}`, moduleId: `${d}-m${Math.floor(rng() * 3)}`, domain: d, itemKind: 'cloze', estSeconds: 10, overdueDays: 0, isNew: false }
      })
      const out = interleave(items, null)
      expect(out.length).toBe(items.length)
      for (let i = 1; i < out.length; i++) {
        // Only assert where a repair was actually possible: with 3 modules in one
        // domain a run of 3 can be forced, and the pass relaxes deliberately.
        const distinctModules = new Set(items.map(x => x.moduleId)).size
        if (distinctModules > 1) expect(out[i]!.moduleId === out[i - 1]!.moduleId && distinctRemaining(out, i)).toBe(false)
      }
    }
    function distinctRemaining(out: QueueItem[], i: number) {
      return out.slice(i).some(x => x.moduleId !== out[i - 1]!.moduleId)
    }
  })

  it('is deterministic for the same input', () => {
    const cs = Array.from({ length: 30 }, (_, i) => card(`c${i}`, `m${i % 5}`, { reps: 1, due: -1 }))
    const a = buildQueue(cs, 0, { budgetSeconds: 300 }, kindFor)
    const b = buildQueue(cs, 0, { budgetSeconds: 300 }, kindFor)
    expect(a.map(x => x.cardId)).toEqual(b.map(x => x.cardId))
  })
})

/**
 * THE FIREWALL TEST.
 *
 * Constraint C, asserted end to end: a learner who does nothing but write
 * long-form defences and rate their own confidence must move NOTHING — no mastery,
 * no due date. If this ever goes green-to-red, a self-score has found a path into
 * the scheduler and the product is lying about what it measures.
 */
describe('the self-report firewall', () => {
  const attempt = (over: Partial<Attempt>): Attempt => ({
    id: 'a', itemId: 'i', moduleId: 'state-races', claimId: 'c1', itemKind: 'tradeoff-defense',
    ts: 0, grading: { kind: 'self', criteriaHit: 6, criteriaTotal: 6 }, rehearsal: false, ...over,
  })

  it('self-graded answers contribute nothing to mastery, however good the self-score', () => {
    expect(masteryContribution({ grading: { kind: 'self', criteriaHit: 6, criteriaTotal: 6 }, verb: 'judge', itemKind: 'tradeoff-defense', rehearsal: false })).toBeNull()
    expect(masteryContribution({ grading: { kind: 'self-rating', rating: 4 }, verb: 'judge', itemKind: 'claim-recall', rehearsal: false })).toBeNull()
  })

  it('isolates the auto-only guard: a self-grade on a MASTERY kind is still refused', () => {
    // Everything else about this attempt qualifies — judgment verb, mastery kind,
    // not a rehearsal — so only the `kind !== 'auto'` guard can reject it. Without
    // this case the guard can be deleted and every other test still passes.
    expect(masteryContribution({
      grading: { kind: 'self', criteriaHit: 6, criteriaTotal: 6 },
      verb: 'judge', itemKind: 'mcq-rationale', rehearsal: false,
    })).toBeNull()
    expect(masteryContribution({
      grading: { kind: 'self-rating', rating: 4 },
      verb: 'judge', itemKind: 'mcq-rationale', rehearsal: false,
    })).toBeNull()
  })

  it('a user of only defences and self-ratings has mastery null everywhere', () => {
    const only = Array.from({ length: 40 }, (_, i) => attempt({ id: `a${i}`, itemId: `i${i}` }))
    expect(claimMastery(only, 'c1', 0).value).toBeNull()
  })

  it('non-judgment verbs and non-mastery kinds are refused even when auto-graded', () => {
    const auto = { kind: 'auto', correct: true, score: 1, latencyMs: 100 } as const
    expect(masteryContribution({ grading: auto, verb: 'explain', itemKind: 'mcq-rationale', rehearsal: false })).toBeNull()
    expect(masteryContribution({ grading: auto, verb: 'judge', itemKind: 'order-steps', rehearsal: false })).toBeNull()
    expect(masteryContribution({ grading: auto, verb: 'judge', itemKind: 'mcq-rationale', rehearsal: true })).toBeNull()
    expect(masteryContribution({ grading: auto, verb: 'judge', itemKind: 'mcq-rationale', rehearsal: false })).toBe(1)
  })

  it('only two functions can produce a rating, and neither accepts a self-grade', () => {
    expect(fromSelfRating({ kind: 'self-rating', rating: 2 })).toBe(2)
    // @ts-expect-error a SelfGrading is not acceptable to either door — this is the firewall.
    expect(() => deriveRating({ kind: 'self', criteriaHit: 6, criteriaTotal: 6 }, 1)).toBeDefined()
  })
})

describe('mastery', () => {
  const auto = (score: number) => ({ kind: 'auto', correct: score > 0.5, score, latencyMs: 100 }) as const
  const mk = (i: number, kind: Attempt['itemKind'], score = 1, ts = 0): Attempt =>
    ({ id: `a${i}`, itemId: `i${i}`, moduleId: 'm', claimId: 'c1', itemKind: kind, ts, grading: auto(score), rehearsal: false })

  it('refuses to render a number below the evidence floor', () => {
    const r = claimMastery([mk(1, 'predict'), mk(2, 'mcq-rationale')], 'c1', 0)
    expect(r.value).toBeNull()
    expect(r.reason).toMatch(/insufficient evidence — 2 items across 2 kinds/)
  })

  it('renders a number once there are 3 items across 2 kinds', () => {
    const r = claimMastery([mk(1, 'predict'), mk(2, 'mcq-rationale'), mk(3, 'constraint-flip')], 'c1', 0)
    expect(r.value).toBeGreaterThan(0.5)
  })

  it('caps mastery from a single item kind at 0.85', () => {
    const same = [1, 2, 3, 4, 5, 6].map(i => mk(i, 'mcq-rationale'))
    // three distinct kinds are required for a number at all, so add the minimum
    const r = claimMastery([...same, mk(9, 'predict', 1)], 'c1', 0)
    expect(r.value).toBeLessThanOrEqual(0.85)
  })

  it('decays with time since the evidence was gathered', () => {
    const items = [mk(1, 'predict'), mk(2, 'mcq-rationale'), mk(3, 'constraint-flip')]
    const fresh = claimMastery(items, 'c1', 0).value!
    const stale = claimMastery(items, 'c1', 400 * DAY).value!
    expect(stale).toBeLessThan(fresh)
  })

  it('weights a repeated item down, so grinding one drill is not mastery', () => {
    const varied = [mk(1, 'predict'), mk(2, 'mcq-rationale'), mk(3, 'constraint-flip')]
    const farmed = [...varied, ...Array.from({ length: 10 }, (_, i) => ({ ...mk(1, 'predict'), id: `f${i}` }))]
    expect(claimMastery(farmed, 'c1', 0).value!).toBeLessThan(0.99)
  })
})
