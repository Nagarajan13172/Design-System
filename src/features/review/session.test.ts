import { describe, it, expect } from 'vitest'
import { reduce, initialSession, summarise, ratable, type SessionState } from './session'
import type { QueueItem } from '@/domain/scheduler/queue'

const q = (id: string, moduleId = 'm'): QueueItem => ({
  cardId: id, moduleId, domain: moduleId.split('-')[0]!, itemKind: 'cloze',
  estSeconds: 12, overdueDays: 0, isNew: false,
})
const auto = (correct: boolean) => ({ kind: 'auto', correct, score: correct ? 1 : 0, latencyMs: 0 }) as const
const start = (n: number): SessionState =>
  reduce(initialSession, { type: 'start', queue: Array.from({ length: n }, (_, i) => q(`c${i}`)), now: 0, budgetSeconds: 420 })

describe('review session', () => {
  it('re-queues a missed card at +5, not immediately', () => {
    let s = start(10)
    s = reduce(s, { type: 'grade', grading: auto(false), now: 1000 })
    // c0 comes back after five intervening cards, so the retry survives interference
    expect(s.queue.slice(1, 7).map(x => x.cardId)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c0'])
  })

  it('counts wrong-then-right, the number worth steering by', () => {
    let s = start(3)
    s = reduce(s, { type: 'grade', grading: auto(false), now: 100 })   // c0 wrong
    while (s.queue[s.cursor]?.cardId !== 'c0' && s.phase === 'running') {
      s = reduce(s, { type: 'grade', grading: auto(true), now: 200 })
    }
    s = reduce(s, { type: 'grade', grading: auto(true), now: 300 })    // c0 right
    expect(s.wrongThenRight).toBe(1)
  })

  it('never re-rates a within-session retry', () => {
    let s = start(2)
    s = reduce(s, { type: 'grade', grading: auto(false), now: 100 })
    while (s.phase === 'running') s = reduce(s, { type: 'grade', grading: auto(true), now: 200 })
    const retries = s.answered.filter(a => a.rehearsal)
    expect(retries.length).toBeGreaterThan(0)
    expect(retries.every(a => !ratable(a))).toBe(true)
    // exactly one ratable attempt per distinct card
    expect(s.answered.filter(ratable).length).toBe(2)
  })

  it('records latency per card from when the card was shown', () => {
    let s = start(2)
    s = reduce(s, { type: 'grade', grading: auto(true), now: 4500 })
    expect(s.answered[0]!.latencyMs).toBe(4500)
    s = reduce(s, { type: 'grade', grading: auto(true), now: 6000 })
    expect(s.answered[1]!.latencyMs).toBe(1500)
  })

  it('ends in summary when the queue is exhausted', () => {
    let s = start(2)
    s = reduce(s, { type: 'grade', grading: auto(true), now: 1 })
    expect(s.phase).toBe('running')
    s = reduce(s, { type: 'grade', grading: auto(true), now: 2 })
    expect(s.phase).toBe('summary')
  })

  it('summarises first attempts only, and reports wrong-then-right', () => {
    let s = start(3)
    s = reduce(s, { type: 'grade', grading: auto(false), now: 1000 })
    while (s.phase === 'running') s = reduce(s, { type: 'grade', grading: auto(true), now: 2000 })
    const sum = summarise(s, 60_000)
    expect(sum.graded).toBe(3)
    expect(sum.correct).toBe(2)
    expect(sum.wrongThenRight).toBe(1)
    expect(sum.elapsedSeconds).toBe(60)
  })

  it('a self-graded long-form answer never counts as correct', () => {
    let s = start(1)
    s = reduce(s, { type: 'grade', grading: { kind: 'self', criteriaHit: 6, criteriaTotal: 6 }, now: 100 })
    expect(summarise(s, 1000).correct).toBe(0)
  })
})
