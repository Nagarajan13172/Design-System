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
