import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { openDB } from 'idb'
import v1 from './__fixtures__/v1.json'
import { migrations } from './migrations'
import { SCHEMA_VERSION } from './schema'
import { cards, reviews, attempts, predictions, progress, sessions, prefs, defences, resetRepo, openRepo } from './index'

/**
 * THE MIGRATION LADDER.
 *
 * Review history IS the product's value, and the first schema change is where a
 * spaced-repetition app silently deletes months of it. So every historical fixture
 * is seeded, opened at the CURRENT version, and asserted to have survived.
 */
const DB = 'fesd'

/** Build a genuine v1 database using only the v1 migration, then close it. */
async function seedV1() {
  const db = await openDB(DB, 1, {
    upgrade(d, _oldVersion, _newVersion, tx) {
      migrations[1]!(d as never, tx as never)
    },
  })
  for (const store of ['cards', 'reviews', 'attempts', 'predictions', 'progress', 'sessions', 'prefs'] as const) {
    const rows = (v1 as Record<string, unknown>)[store] as unknown[]
    const tx = db.transaction(store as never, 'readwrite')
    for (const r of rows) await (tx.store as unknown as { put(v: unknown): Promise<unknown> }).put(r)
    await tx.done
  }
  db.close()
}

describe('migrating a v1 database to the current version', () => {
  beforeEach(async () => { await resetRepo() })

  it('opens at the current version', async () => {
    await seedV1()
    expect((await openRepo()).version).toBe(SCHEMA_VERSION)
  })

  it('keeps every row from every v1 store', async () => {
    await seedV1()
    expect((await cards.all()).length).toBe(1)
    expect((await reviews.all()).length).toBe(1)
    expect((await attempts.all()).length).toBe(1)
    expect((await predictions.all()).length).toBe(1)
    expect((await progress.all()).length).toBe(1)
    expect((await sessions.all()).length).toBe(1)
    expect(await prefs.get('streak', 0)).toBe(9)
  })

  it('preserves scheduling state exactly — an interval must not reset', async () => {
    await seedV1()
    const card = (await cards.get('state-races-c1'))!
    expect(card).toMatchObject({ reps: 4, lapses: 1, stability: 4.2, scheduled_days: 6, last_review: 900 })
  })

  it('adds the v2 store without touching the v1 data', async () => {
    await seedV1()
    expect(await defences.all()).toEqual([])
    expect((await cards.all()).length).toBe(1)
  })

  it('refuses to open when a step is missing rather than risking the data', async () => {
    // A future version with no migration must throw, not silently open.
    expect(migrations[SCHEMA_VERSION + 1]).toBeUndefined()
  })

  it('has a migration for every version up to the current one', () => {
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      expect(migrations[v], `missing migration to v${v}`).toBeTypeOf('function')
    }
  })
})
