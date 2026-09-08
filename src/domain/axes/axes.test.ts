import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { markCovered, recordConfidence, shouldAskConfidence, moduleAxes, reviewForecast, CONFIDENCE_COOLDOWN_MS } from './index'
import { progress, attempts, cards, resetRepo } from '@/data/repo'
import type { AttemptRow } from '@/data/repo/schema'

const DAY = 86_400_000
const att = (i: number, kind: AttemptRow['itemKind'], claimId = 'c1', score = 1): AttemptRow => ({
  id: `a${i}`, itemId: `i${i}`, moduleId: 'm1', claimId, itemKind: kind, ts: 0,
  grading: { kind: 'auto', correct: score > 0.5, score, latencyMs: 100 }, rehearsal: false,
})

/**
 * THE THREE AXES MOVE INDEPENDENTLY.
 *
 * This is the M3 exit criterion, asserted directly: each axis has exactly one door,
 * and going through one must not move the others.
 */
describe('the three axes', () => {
  beforeEach(async () => { await resetRepo() })

  it('the recall gate moves Coverage and NOTHING else', async () => {
    await markCovered('m1', 1000)
    const axes = await moduleAxes('m1', ['c1'], 1000)
    expect(axes.coverage).toBe('covered')
    expect(axes.confidence).toBeNull()
    expect(axes.mastery[0]!.result.value).toBeNull()
  })

  it('confidence moves Confidence and NOTHING else', async () => {
    await recordConfidence('m1', 4, 1000)
    const axes = await moduleAxes('m1', ['c1'], 1000)
    expect(axes.confidence).toBe(4)
    expect(axes.coverage).toBe('none')
    expect(axes.mastery[0]!.result.value).toBeNull()
  })

  it('auto-graded judgment evidence moves Mastery and NOTHING else', async () => {
    await attempts.append([att(1, 'predict'), att(2, 'mcq-rationale'), att(3, 'constraint-flip')])
    const axes = await moduleAxes('m1', ['c1'], 0)
    expect(axes.mastery[0]!.result.value).toBeGreaterThan(0.5)
    expect(axes.coverage).toBe('none')
    expect(axes.confidence).toBeNull()
  })

  it('mastery reads insufficient evidence at 2 items and a number at 3 across 2 kinds', async () => {
    await attempts.append([att(1, 'predict'), att(2, 'mcq-rationale')])
    let axes = await moduleAxes('m1', ['c1'], 0)
    expect(axes.mastery[0]!.result.value).toBeNull()
    expect(axes.mastery[0]!.result.reason).toMatch(/insufficient evidence/)
    expect(axes.claimsWithEvidence).toBe(0)

    await attempts.append([att(3, 'constraint-flip')])
    axes = await moduleAxes('m1', ['c1'], 0)
    expect(axes.mastery[0]!.result.value).not.toBeNull()
    expect(axes.claimsWithEvidence).toBe(1)
  })

  it('coverage is idempotent and keeps the first coveredAt', async () => {
    await markCovered('m1', 1000)
    await markCovered('m1', 5000)
    expect((await progress.get('m1'))!.coveredAt).toBe(1000)
  })

  it('confidence is refused inside the 14-day cooldown, so it stays a signal', async () => {
    expect(await shouldAskConfidence('m1', 0)).toBe(true)
    expect(await recordConfidence('m1', 5, 0)).toBe(true)
    expect(await shouldAskConfidence('m1', 3 * DAY)).toBe(false)
    expect(await recordConfidence('m1', 1, 3 * DAY)).toBe(false)
    expect((await progress.get('m1'))!.confidence).toBe(5)   // unchanged
    expect(await shouldAskConfidence('m1', CONFIDENCE_COOLDOWN_MS + 1)).toBe(true)
  })

  it('marking coverage does not disturb an existing confidence, and vice versa', async () => {
    await recordConfidence('m1', 3, 0)
    await markCovered('m1', 100)
    const row = (await progress.get('m1'))!
    expect(row.confidence).toBe(3)
    expect(row.coverage).toBe('covered')
  })

  it('the forecast buckets overdue cards onto today', async () => {
    const base = { moduleId: 'm1', stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 2 as const, last_review: 0, status: 'active' as const }
    await cards.putMany([
      { ...base, id: 'a', due: 5 * DAY },
      { ...base, id: 'b', due: 12 * DAY },
      { ...base, id: 'c', due: 1 * DAY },     // overdue relative to `now` below
      { ...base, id: 'd', due: 9 * DAY, status: 'retired' },
    ])
    const f = await reviewForecast(2 * DAY, 30)
    expect(f[0]).toBe(1)     // the overdue one
    expect(f[3]).toBe(1)     // due in 3 days
    expect(f[10]).toBe(1)
    expect(f.reduce((s, v) => s + v, 0)).toBe(3)   // the retired card is absent
  })
})
