import type { IDBPDatabase, OpenDBCallbacks } from 'idb'
import type { FesdSchema } from './schema'

/**
 * THE MIGRATION LADDER.
 *
 * Indexed by TARGET version, so `migrations[n]` upgrades a database at n-1 to n.
 * Every step keeps a committed fixture in __fixtures__/v<n-1>.json, and the test
 * seeds every historical fixture, opens at the current version, and asserts the
 * data survived.
 *
 * This exists because the first schema change is where a spaced-repetition app
 * silently deletes months of review history, and the user finds out weeks later
 * when their retention curve has a cliff in it.
 */
/** Exactly the transaction type idb hands the `upgrade` callback — derived, not restated. */
type UpgradeTx = Parameters<NonNullable<OpenDBCallbacks<FesdSchema>['upgrade']>>[3]

export type Migration = (db: IDBPDatabase<FesdSchema>, tx: UpgradeTx) => void

export const migrations: Record<number, Migration> = {
  1: db => {
    const cards = db.createObjectStore('cards', { keyPath: 'id' })
    cards.createIndex('by-due', 'due')
    cards.createIndex('by-module', 'moduleId')

    const reviews = db.createObjectStore('reviews', { keyPath: 'id' })
    reviews.createIndex('by-card', 'cardId')
    reviews.createIndex('by-ts', 'ts')

    const attempts = db.createObjectStore('attempts', { keyPath: 'id' })
    attempts.createIndex('by-claim', 'claimId')
    attempts.createIndex('by-ts', 'ts')
    attempts.createIndex('by-module', 'moduleId')

    db.createObjectStore('predictions', { keyPath: 'figureId' })
    db.createObjectStore('progress', { keyPath: 'moduleId' })

    const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
    sessions.createIndex('by-started', 'startedAt')

    db.createObjectStore('prefs', { keyPath: 'key' })
  },

  /**
   * v2 — the Trade-off Defence store.
   *
   * The first real migration, and the reason the ladder exists: a learner who has
   * been reviewing for a month must not lose that history because a later milestone
   * added a feature. `__fixtures__/v1.json` is a committed v1 database; the
   * migration test opens it at the current version and asserts every row survived.
   */
  2: db => {
    const defences = db.createObjectStore('defences', { keyPath: 'id' })
    defences.createIndex('by-due', 'dueAt')
    defences.createIndex('by-module', 'moduleId')
  },
}

export function runMigrations(db: IDBPDatabase<FesdSchema>, tx: UpgradeTx, from: number, to: number) {
  for (let v = from + 1; v <= to; v++) {
    const step = migrations[v]
    if (!step) throw new Error(`no migration to schema v${v}: refusing to open and risk corrupting history`)
    step(db, tx)
  }
}
