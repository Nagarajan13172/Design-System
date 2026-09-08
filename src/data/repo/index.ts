import { openDB, type IDBPDatabase } from 'idb'
import type { FesdSchema, CardRow, ReviewRow, AttemptRow, PredictionRow, ModuleProgressRow, SessionRow, DefenceRow, StoreName } from './schema'
import { SCHEMA_VERSION, STORES } from './schema'
import { runMigrations } from './migrations'
import type { ClaimId, FigureId, ModuleId } from '@content/types'

/**
 * ADR-3: THE ONLY PLACE `idb` IS IMPORTED.
 *
 * ESLint enforces it. One import site means one place to test migrations, one place
 * to enforce transaction boundaries, and one place where QuotaExceededError flips
 * the degraded flag — rather than each of those concerns being reinvented per
 * feature and getting it subtly wrong in three of them.
 */

const DB_NAME = 'fesd'
let dbp: Promise<IDBPDatabase<FesdSchema>> | null = null

export interface RepoOptions { name?: string }

export function openRepo(opts: RepoOptions = {}) {
  const name = opts.name ?? DB_NAME
  if (!dbp || opts.name) {
    const p = openDB<FesdSchema>(name, SCHEMA_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        runMigrations(db, tx, oldVersion, newVersion ?? SCHEMA_VERSION)
      },
      blocking() {
        // Another tab wants to upgrade. Close so it can, rather than deadlocking both.
        void dbp?.then(d => d.close())
        dbp = null
      },
    })
    if (!opts.name) dbp = p
    return p
  }
  return dbp
}

/** Tests and `import` need a clean slate. */
export async function resetRepo(name = DB_NAME) {
  if (dbp) { (await dbp).close(); dbp = null }
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase(name)
    r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res()
  })
}

/** Set by the quota watcher. When true the UI stops promising durability. */
export let degraded = false
export const setDegraded = (v: boolean) => { degraded = v }

async function write<T>(fn: (db: IDBPDatabase<FesdSchema>) => Promise<T>): Promise<T> {
  try {
    return await fn(await openRepo())
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      setDegraded(true)
      throw new Error('storage is full — export your progress from Settings before continuing')
    }
    throw e
  }
}

// --- typed accessors --------------------------------------------------------
// Features call these. Nothing outside this directory knows IndexedDB exists.

export const cards = {
  async get(id: ClaimId) { return (await openRepo()).get('cards', id) },
  async all() { return (await openRepo()).getAll('cards') },
  async byModule(moduleId: ModuleId) { return (await openRepo()).getAllFromIndex('cards', 'by-module', moduleId) },
  /** The due queue's source. Retired cards are filtered here, once. */
  async dueBefore(ts: number) {
    const db = await openRepo()
    const rows = await db.getAllFromIndex('cards', 'by-due', IDBKeyRange.upperBound(ts))
    return rows.filter(c => c.status === 'active')
  },
  async put(row: CardRow) { return write(db => db.put('cards', row)) },
  async putMany(rows: CardRow[]) {
    return write(async db => {
      const tx = db.transaction('cards', 'readwrite')
      await Promise.all([...rows.map(r => tx.store.put(r)), tx.done])
    })
  },
}

export const reviews = {
  /** Append-only, and idempotent: the same (card, ts, rating) can be replayed safely. */
  async append(rows: ReviewRow[]) {
    return write(async db => {
      const tx = db.transaction('reviews', 'readwrite')
      await Promise.all([...rows.map(r => tx.store.put(r)), tx.done])
    })
  },
  async byCard(cardId: ClaimId) { return (await openRepo()).getAllFromIndex('reviews', 'by-card', cardId) },
  async since(ts: number) { return (await openRepo()).getAllFromIndex('reviews', 'by-ts', IDBKeyRange.lowerBound(ts)) },
  async all() { return (await openRepo()).getAll('reviews') },
}

export const attempts = {
  async append(rows: AttemptRow[]) {
    return write(async db => {
      const tx = db.transaction('attempts', 'readwrite')
      await Promise.all([...rows.map(r => tx.store.put(r)), tx.done])
    })
  },
  async byClaim(claimId: ClaimId) { return (await openRepo()).getAllFromIndex('attempts', 'by-claim', claimId) },
  async byModule(moduleId: ModuleId) { return (await openRepo()).getAllFromIndex('attempts', 'by-module', moduleId) },
  async all() { return (await openRepo()).getAll('attempts') },
  async since(ts: number) { return (await openRepo()).getAllFromIndex('attempts', 'by-ts', IDBKeyRange.lowerBound(ts)) },
}

export const predictions = {
  async get(figureId: FigureId) { return (await openRepo()).get('predictions', figureId) },
  /** Immutable: a second commit for the same figure is ignored, not overwritten. */
  async commit(row: PredictionRow) {
    return write(async db => {
      const tx = db.transaction('predictions', 'readwrite')
      if (!(await tx.store.get(row.figureId))) await tx.store.put(row)
      await tx.done
    })
  },
  async all() { return (await openRepo()).getAll('predictions') },
}

export const progress = {
  async get(moduleId: ModuleId) { return (await openRepo()).get('progress', moduleId) },
  async all() { return (await openRepo()).getAll('progress') },
  async put(row: ModuleProgressRow) { return write(db => db.put('progress', row)) },
}

export const sessions = {
  async put(row: SessionRow) { return write(db => db.put('sessions', row)) },
  async all() { return (await openRepo()).getAll('sessions') },
  async recent(n: number) {
    const db = await openRepo()
    const rows = await db.getAllFromIndex('sessions', 'by-started')
    return rows.slice(-n).reverse()
  },
}

export const defences = {
  async put(row: DefenceRow) { return write(db => db.put('defences', row)) },
  async all() { return (await openRepo()).getAll('defences') },
  /** The articulation queue: a FIXED interval, never touched by the scheduler. */
  async dueBefore(ts: number) {
    const db = await openRepo()
    const rows = await db.getAllFromIndex('defences', 'by-due', IDBKeyRange.upperBound(ts))
    return rows.filter(d => d.revisitedAt == null)
  },
  async byModule(moduleId: ModuleId) { return (await openRepo()).getAllFromIndex('defences', 'by-module', moduleId) },
}

export const prefs = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await (await openRepo()).get('prefs', key)
    return (row?.value as T) ?? fallback
  },
  async set(key: string, value: unknown) { return write(db => db.put('prefs', { key, value })) },
  async all() { return (await openRepo()).getAll('prefs') },
}

// --- raw access, for export/import only -------------------------------------
export async function dumpAll(): Promise<Record<StoreName, unknown[]>> {
  const db = await openRepo()
  const out = {} as Record<StoreName, unknown[]>
  for (const s of STORES) out[s] = await db.getAll(s)
  return out
}

export async function bulkPut(store: StoreName, rows: unknown[]) {
  return write(async db => {
    const tx = db.transaction(store, 'readwrite')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Promise.all([...rows.map(r => tx.store.put(r as any)), tx.done])
  })
}

export { SCHEMA_VERSION, STORES }
export type { CardRow, ReviewRow, AttemptRow, PredictionRow, ModuleProgressRow, SessionRow, DefenceRow, StoreName }
