import type { AttemptRow } from './schema'

/**
 * Under storage pressure, old raw attempts fold into per-(module, kind) summaries.
 *
 * Mastery decays on a 120-day half-life, so an attempt from a year ago contributes
 * almost nothing to the number but costs the same bytes as a fresh one. Folding it
 * keeps the axis honest while bounding growth.
 */
export interface AttemptSummary {
  moduleId: string
  itemKind: string
  count: number
  scoreSum: number
  lastTs: number
}

export const ROLLUP_AFTER_DAYS = 90
export const PRESSURE_THRESHOLD = 0.8

export function foldOldAttempts(rows: AttemptRow[], now: number, afterDays = ROLLUP_AFTER_DAYS) {
  const cutoff = now - afterDays * 86_400_000
  const keep = rows.filter(r => r.ts >= cutoff)
  const old = rows.filter(r => r.ts < cutoff)
  const summaries = new Map<string, AttemptSummary>()
  for (const r of old) {
    const key = `${r.moduleId}|${r.itemKind}`
    const s = summaries.get(key) ?? { moduleId: r.moduleId, itemKind: r.itemKind, count: 0, scoreSum: 0, lastTs: 0 }
    s.count++
    s.scoreSum += r.grading.kind === 'auto' ? r.grading.score : 0
    s.lastTs = Math.max(s.lastTs, r.ts)
    summaries.set(key, s)
  }
  return { keep, folded: [...summaries.values()], foldedCount: old.length }
}

/**
 * Runs at session end, and only under pressure.
 *
 * Mastery decays on a 120-day half-life, so an attempt from a year ago contributes
 * almost nothing to the number while costing the same bytes as a fresh one. Folding
 * it keeps the axis honest and bounds growth — and doing it ONLY above the threshold
 * means a learner with room to spare keeps their full history.
 */
export async function rollupIfPressured(now: number): Promise<{ ran: boolean; folded: number }> {
  const { storageHealth } = await import('./persist')
  const { attempts, prefs } = await import('./index')
  const health = await storageHealth()
  if (health.pressure == null || health.pressure <= PRESSURE_THRESHOLD) return { ran: false, folded: 0 }

  const rows = await attempts.all()
  const { keep, folded, foldedCount } = foldOldAttempts(rows, now)
  if (!foldedCount) return { ran: true, folded: 0 }

  // Summaries are kept in prefs rather than a new store: they are a handful of rows
  // and inventing a store for them would need another migration.
  await prefs.set('attemptSummaries', folded)
  await prefs.set('lastRollupAt', now)
  const { bulkPut, resetStore } = await import('./index')
  await resetStore('attempts')
  await bulkPut('attempts', keep)
  return { ran: true, folded: foldedCount }
}
