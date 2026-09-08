import { describe, it, expect } from 'vitest'
import { foldOldAttempts, ROLLUP_AFTER_DAYS } from './rollup'
import type { AttemptRow } from './schema'

const DAY = 86_400_000
const att = (id: string, ts: number, moduleId = 'm1', score = 1): AttemptRow => ({
  id, itemId: `i-${id}`, moduleId, claimId: 'c1', itemKind: 'predict', ts,
  grading: { kind: 'auto', correct: score > 0.5, score, latencyMs: 100 }, rehearsal: false,
})

describe('folding old attempts', () => {
  const now = 400 * DAY

  it('keeps everything inside the window and folds what is outside', () => {
    const rows = [att('a', now - 10 * DAY), att('b', now - 200 * DAY), att('c', now - 300 * DAY)]
    const r = foldOldAttempts(rows, now)
    expect(r.keep.map(x => x.id)).toEqual(['a'])
    expect(r.foldedCount).toBe(2)
  })

  it('preserves the count and score sum, so mastery stays computable', () => {
    const rows = [att('b', now - 200 * DAY, 'm1', 1), att('c', now - 300 * DAY, 'm1', 0.5)]
    const [s] = foldOldAttempts(rows, now).folded
    expect(s).toMatchObject({ moduleId: 'm1', itemKind: 'predict', count: 2, scoreSum: 1.5 })
  })

  it('summarises per module and per item kind, not in one bucket', () => {
    const rows = [
      att('b', now - 200 * DAY, 'm1'),
      { ...att('c', now - 200 * DAY, 'm2'), itemKind: 'cloze' as const },
    ]
    expect(foldOldAttempts(rows, now).folded).toHaveLength(2)
  })

  it('does nothing when everything is recent', () => {
    const rows = [att('a', now - 5 * DAY), att('b', now - 20 * DAY)]
    const r = foldOldAttempts(rows, now)
    expect(r.foldedCount).toBe(0)
    expect(r.keep).toHaveLength(2)
  })

  it('folds exactly at the boundary, not before it', () => {
    const justInside = foldOldAttempts([att('a', now - (ROLLUP_AFTER_DAYS - 1) * DAY)], now)
    const justOutside = foldOldAttempts([att('a', now - (ROLLUP_AFTER_DAYS + 1) * DAY)], now)
    expect(justInside.foldedCount).toBe(0)
    expect(justOutside.foldedCount).toBe(1)
  })
})
