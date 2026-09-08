import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { cards, reviews, attempts, predictions, progress, prefs, resetRepo, openRepo, SCHEMA_VERSION } from './index'
import { exportAll, planImport, applyImport } from './transfer'
import type { CardRow } from './schema'

const card = (id: string, over: Partial<CardRow> = {}): CardRow => ({
  id, moduleId: 'state-races', due: 0, stability: 1, difficulty: 5, elapsed_days: 0,
  scheduled_days: 1, reps: 1, lapses: 0, state: 2, last_review: 1000, status: 'active', ...over,
})

describe('repository', () => {
  beforeEach(async () => { await resetRepo() })

  it('opens at the current schema version and creates every store', async () => {
    const db = await openRepo()
    expect(db.version).toBe(SCHEMA_VERSION)
    for (const s of ['cards', 'reviews', 'attempts', 'predictions', 'progress', 'sessions', 'prefs']) {
      expect(db.objectStoreNames.contains(s as never)).toBe(true)
    }
  })

  it('dueBefore excludes retired cards', async () => {
    await cards.putMany([
      card('a', { due: 100 }),
      card('b', { due: 100, status: 'retired' }),
      card('c', { due: 9_999_999 }),
    ])
    const due = await cards.dueBefore(1000)
    expect(due.map(c => c.id)).toEqual(['a'])
  })

  it('a prediction is immutable once committed', async () => {
    const row = { figureId: 'f1', moduleId: 'state-races', value: 4, confidence: 70, committedAt: 1 }
    await predictions.commit(row)
    await predictions.commit({ ...row, value: 99, confidence: 100 })
    expect((await predictions.get('f1'))!.value).toBe(4)
  })

  it('reviews are append-only and replay-safe', async () => {
    const r = {
      id: 'r1', cardId: 'a', ts: 5, rating: 3 as const, itemId: 'i1', itemKind: 'cloze' as const,
      latencyMs: 1000, pre: {} as never, post: {} as never,
    }
    await reviews.append([r]); await reviews.append([r])
    expect((await reviews.all()).length).toBe(1)
  })
})

describe('export / import', () => {
  beforeEach(async () => { await resetRepo() })

  const seed = async () => {
    await cards.putMany([card('a'), card('b', { moduleId: 'found-event-loop' })])
    await reviews.append([{ id: 'r1', cardId: 'a', ts: 5, rating: 3, itemId: 'i1', itemKind: 'cloze', latencyMs: 900, pre: {} as never, post: {} as never }])
    await attempts.append([{ id: 't1', itemId: 'i1', moduleId: 'state-races', claimId: 'a', itemKind: 'cloze', ts: 5, grading: { kind: 'auto', correct: true, score: 1, latencyMs: 900 }, rehearsal: false }])
    await progress.put({ moduleId: 'state-races', coverage: 'covered', coveredAt: 9, confidence: 4, confidenceAt: 9 })
    await prefs.set('theme', 'dark')
  }

  it('export -> wipe -> import restores the data exactly', async () => {
    await seed()
    const env = await exportAll(1234)
    await resetRepo()
    expect((await cards.all()).length).toBe(0)

    const report = await applyImport(env)
    expect(report.ok).toBe(true)
    expect((await cards.all()).length).toBe(2)
    expect((await reviews.all()).length).toBe(1)
    expect((await attempts.all()).length).toBe(1)
    expect((await prefs.get('theme', 'light'))).toBe('dark')

    // byte-identical round trip
    const again = await exportAll(1234)
    expect(JSON.stringify(again.stores)).toBe(JSON.stringify(env.stores))
  })

  it('re-importing the same file is a no-op', async () => {
    await seed()
    const env = await exportAll(1)
    await applyImport(env)
    await applyImport(env)
    expect((await reviews.all()).length).toBe(1)
    expect((await attempts.all()).length).toBe(1)
    expect((await cards.all()).length).toBe(2)
  })

  it('dry-run reports the plan and never writes', async () => {
    await seed()
    const env = await exportAll(1)
    await resetRepo()
    const report = await planImport(env)
    expect(report.ok).toBe(true)
    expect(report.plan.cards!.added).toBe(2)
    expect((await cards.all()).length).toBe(0)   // nothing written by a plan
  })

  it('refuses an export from a newer schema rather than half-importing it', async () => {
    const report = await planImport({ v: SCHEMA_VERSION + 1, exportedAt: 0, appBuild: 'x', deviceId: 'y', stores: {} as never })
    expect(report.ok).toBe(false)
    expect(report.errors[0]).toMatch(/Update the app first/)
  })

  it('merges two devices rather than letting the last import win', async () => {
    await seed()
    const deviceA = await exportAll(1, 'x', 'A')
    await resetRepo()
    await cards.putMany([card('c', { moduleId: 'perf-lcp' })])
    await reviews.append([{ id: 'r2', cardId: 'c', ts: 7, rating: 4, itemId: 'i2', itemKind: 'predict', latencyMs: 500, pre: {} as never, post: {} as never }])

    await applyImport(deviceA)
    expect((await cards.all()).map(c => c.id).sort()).toEqual(['a', 'b', 'c'])
    expect((await reviews.all()).length).toBe(2)
  })

  it('a card that has seen more history wins the merge', async () => {
    await cards.putMany([card('a', { last_review: 5000, reps: 9 })])
    const env = { v: SCHEMA_VERSION, exportedAt: 0, appBuild: 'x', deviceId: 'B', stores: { cards: [card('a', { last_review: 1000, reps: 2 })], reviews: [], attempts: [], predictions: [], progress: [], sessions: [], prefs: [] } }
    await applyImport(env as never)
    expect((await cards.get('a'))!.reps).toBe(9)   // the older export did not clobber it
  })
})
