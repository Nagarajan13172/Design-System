import { dumpAll, bulkPut, resetRepo, STORES, SCHEMA_VERSION, type StoreName } from './index'

/**
 * EXPORT / IMPORT.
 *
 * With no backend the browser is the only copy, and browsers delete it — Safari's
 * ITP evicts IndexedDB for non-installed sites after ~7 days idle. Export is not a
 * convenience feature here, it is the durability story, so import has to be
 * MERGE-AWARE rather than destructive: a learner who exports on two devices and
 * imports both must end up with the union, not whichever they imported last.
 */

export interface Envelope {
  v: number
  exportedAt: number
  appBuild: string
  deviceId: string
  stores: Record<StoreName, unknown[]>
}

/** Append-only rows are deduped by identity, so replaying an export is a no-op. */
const IDENTITY: Partial<Record<StoreName, (r: Record<string, unknown>) => string>> = {
  reviews: r => `${r.cardId}|${r.ts}|${r.rating}`,
  attempts: r => `${r.itemId}|${r.ts}`,
}

export async function exportAll(now: number, appBuild = 'dev', deviceId = 'local'): Promise<Envelope> {
  return { v: SCHEMA_VERSION, exportedAt: now, appBuild, deviceId, stores: await dumpAll() }
}

export interface ImportReport {
  ok: boolean
  errors: string[]
  /** Per store: how many rows are new, already present, or would be merged. */
  plan: Record<string, { incoming: number; added: number; duplicate: number; merged: number }>
}

/**
 * DRY RUN FIRST, ALWAYS.
 *
 * `apply()` will not write anything until a plan has been computed and shown, so a
 * malformed or foreign file cannot half-import and leave the learner with a
 * corrupted history and no way back.
 */
export async function planImport(env: Envelope): Promise<ImportReport> {
  const errors: string[] = []
  const plan: ImportReport['plan'] = {}

  if (typeof env?.v !== 'number') errors.push('not a progress export (no schema version)')
  else if (env.v > SCHEMA_VERSION) errors.push(`export is from schema v${env.v}; this build understands up to v${SCHEMA_VERSION}. Update the app first.`)

  if (errors.length) return { ok: false, errors, plan }

  const existing = await dumpAll()
  for (const store of STORES) {
    const incoming = (env.stores?.[store] ?? []) as Record<string, unknown>[]
    const id = IDENTITY[store]
    const have = new Set(
      (existing[store] as Record<string, unknown>[]).map(r => (id ? id(r) : String(r[keyOf(store)]))),
    )
    let added = 0, duplicate = 0, merged = 0
    for (const row of incoming) {
      const k = id ? id(row) : String(row[keyOf(store)])
      if (!have.has(k)) { added++; have.add(k) }
      else if (id) duplicate++      // append-only: identical event, ignore
      else merged++                 // keyed row: newest wins, see apply()
    }
    plan[store] = { incoming: incoming.length, added, duplicate, merged }
  }
  return { ok: true, errors, plan }
}

const keyOf = (s: StoreName): string =>
  s === 'cards' ? 'id' : s === 'predictions' ? 'figureId' : s === 'progress' ? 'moduleId'
    : s === 'prefs' ? 'key' : 'id'

/**
 * Merge policy:
 *   - reviews/attempts: append-only, deduped by identity. Never overwritten.
 *   - cards: the row with the LATER last_review wins (it has seen more history).
 *   - predictions: first commit wins, forever. The gate depends on immutability.
 *   - progress/sessions/prefs: newest wins.
 */
export async function applyImport(env: Envelope): Promise<ImportReport> {
  const report = await planImport(env)
  if (!report.ok) return report

  const existing = await dumpAll()
  for (const store of STORES) {
    const incoming = (env.stores?.[store] ?? []) as Record<string, unknown>[]
    if (!incoming.length) continue
    const id = IDENTITY[store]
    const k = keyOf(store)

    if (id) {
      const have = new Set((existing[store] as Record<string, unknown>[]).map(id))
      const fresh = incoming.filter(r => !have.has(id(r)))
      if (fresh.length) await bulkPut(store, fresh)
      continue
    }

    const byKey = new Map((existing[store] as Record<string, unknown>[]).map(r => [String(r[k]), r]))
    const toWrite: unknown[] = []
    for (const row of incoming) {
      const mine = byKey.get(String(row[k]))
      if (!mine) { toWrite.push(row); continue }
      if (store === 'predictions') continue                       // immutable
      if (store === 'cards') {
        const a = Number(mine.last_review ?? 0), b = Number(row.last_review ?? 0)
        if (b > a) toWrite.push(row)
        continue
      }
      toWrite.push(row)                                            // newest wins
    }
    if (toWrite.length) await bulkPut(store, toWrite)
  }
  return report
}

/** Only from Settings, behind a typed confirmation. */
export async function wipe() { await resetRepo() }
