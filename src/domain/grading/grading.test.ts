import { describe, it, expect } from 'vitest'
import { gradeAttempt, kendall, withinEditDistance } from './index'
import { tokenPresence, wordCount } from './tokens'
import type { Item } from '@content/types'

const item = (kind: Item['kind'], payload: unknown): Item =>
  ({ id: 'i', kind, primaryClaim: 'c', prompt: 'p', payload })

describe('cloze', () => {
  const it_ = item('cloze', { blanks: ['monotonic', 'newest'], accept: { 1: ['latest', 'current'] } })
  it('accepts an authored synonym', () => {
    expect(gradeAttempt(it_, { kind: 'cloze', values: ['monotonic', 'latest'] }, 0).grading.correct).toBe(true)
  })
  it('forgives a typo within edit distance 2', () => {
    expect(gradeAttempt(it_, { kind: 'cloze', values: ['monotonik', 'newest'] }, 0).grading.correct).toBe(true)
    expect(withinEditDistance('cursor', 'curser')).toBe(true)
    expect(withinEditDistance('cursor', 'offset')).toBe(false)
  })
  it('gives partial credit per blank', () => {
    expect(gradeAttempt(it_, { kind: 'cloze', values: ['monotonic', 'wrong'] }, 0).grading.score).toBe(0.5)
  })
})

describe('mcq-rationale', () => {
  const it_ = item('mcq-rationale', { correct: 1, correctRationale: 2 })
  it('requires both screens for full credit', () => {
    expect(gradeAttempt(it_, { kind: 'mcq-rationale', option: 1, rationale: 2 }, 0).grading.score).toBe(1)
  })
  it('scores right-answer/wrong-reason at 0.4 and says so', () => {
    const r = gradeAttempt(it_, { kind: 'mcq-rationale', option: 1, rationale: 0 }, 0)
    expect(r.grading.score).toBe(0.4)
    expect(r.grading.correct).toBe(false)
    expect(r.explanation).toMatch(/wrong reason/i)
  })
  it('scores a wrong option at 0 regardless of rationale', () => {
    expect(gradeAttempt(it_, { kind: 'mcq-rationale', option: 3, rationale: 2 }, 0).grading.score).toBe(0)
  })
})

describe('order-steps', () => {
  it('gives partial credit by Kendall tau', () => {
    expect(kendall([0, 1, 2, 3])).toBe(1)
    expect(kendall([0, 1, 3, 2])).toBeGreaterThan(0.7)
    expect(kendall([3, 2, 1, 0])).toBe(0)
  })
  it('zeroes when an authored causal pair is inverted, however good the rest', () => {
    const it_ = item('order-steps', { hardOrder: [[0, 1]] })
    const r = gradeAttempt(it_, { kind: 'order-steps', order: [1, 0, 2, 3] }, 0)
    expect(r.grading.score).toBe(0)
    expect(r.explanation).toMatch(/causal/i)
  })
})

describe('constraint-flip — the workhorse', () => {
  const it_ = item('constraint-flip', { direction: 'up', correctBand: 2, flipParameter: 'p95 latency' })
  it('weights direction 0.6 and magnitude 0.4', () => {
    expect(gradeAttempt(it_, { kind: 'constraint-flip', direction: 'up', band: 2 }, 0).grading.score).toBe(1)
    expect(gradeAttempt(it_, { kind: 'constraint-flip', direction: 'up', band: 0 }, 0).grading.score).toBeCloseTo(0.6)
    expect(gradeAttempt(it_, { kind: 'constraint-flip', direction: 'down', band: 2 }, 0).grading.score).toBeCloseTo(0.4)
  })
  it('names the deciding parameter when the direction is wrong', () => {
    const r = gradeAttempt(it_, { kind: 'constraint-flip', direction: 'down', band: 0 }, 0)
    expect(r.explanation).toContain('p95 latency')
  })
})

describe('predict', () => {
  it('point: grades against an authored tolerance', () => {
    const it_ = item('predict', { control: 'point', correct: 1.3, tolerance: { abs: 2.5 } })
    expect(gradeAttempt(it_, { kind: 'predict', value: 3 }, 0).grading.correct).toBe(true)
    expect(gradeAttempt(it_, { kind: 'predict', value: 18 }, 0).grading.correct).toBe(false)
  })
  it('rank: exact scores 1, top-1 scores 0.5', () => {
    const it_ = item('predict', { control: 'rank', correct: ['D', 'B', 'A', 'C'] })
    expect(gradeAttempt(it_, { kind: 'predict', value: ['D', 'B', 'A', 'C'] }, 0).grading.score).toBe(1)
    expect(gradeAttempt(it_, { kind: 'predict', value: ['D', 'B', 'C', 'A'] }, 0).grading.score).toBe(0.5)
    expect(gradeAttempt(it_, { kind: 'predict', value: ['A', 'B', 'C', 'D'] }, 0).grading.score).toBe(0)
  })
  it('reports where a wrong prediction diverges, so the figure can scrub there', () => {
    const it_ = item('predict', { control: 'rank', correct: ['D', 'B', 'A', 'C'] })
    expect(gradeAttempt(it_, { kind: 'predict', value: ['D', 'B', 'C', 'A'] }, 0).divergesAtStage).toBe(2)
    expect(gradeAttempt(it_, { kind: 'predict', value: ['D', 'B', 'A', 'C'] }, 0).divergesAtStage).toBeUndefined()
  })
})

describe('claim-recall is not auto-gradable', () => {
  it('refuses rather than inventing a score', () => {
    expect(() => gradeAttempt(item('claim-recall', {}), { kind: 'claim-recall', rating: 3 }, 0))
      .toThrow(/fromSelfRating/)
  })
})

describe('concept tokens — a flag, never a score', () => {
  const groups = [['cursor', 'keyset'], ['stable', 'deterministic'], ['order', 'ordering']]
  it('is AND across groups, OR within one', () => {
    expect(tokenPresence('use a keyset with a deterministic ordering', groups).allPresent).toBe(true)
    expect(tokenPresence('use a cursor', groups).allPresent).toBe(false)
  })
  it('reports which groups are missing, for evidence highlighting', () => {
    const r = tokenPresence('use a cursor', groups)
    expect(r.missing).toEqual([['stable', 'deterministic'], ['order', 'ordering']])
    expect(r.present).toEqual([true, false, false])
  })
  it('counts words for the recall gate target', () => {
    expect(wordCount('  the quick   brown fox. ')).toBe(4)
  })
})
