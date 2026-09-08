import { progress, attempts, cards } from '@/data/repo'
import type { ModuleProgressRow } from '@/data/repo/schema'
import type { ClaimId, ModuleId, Tier } from '@content/types'
import { claimMastery, type MasteryResult } from './mastery'

/**
 * THREE AXES, THREE UNITS, THREE VISUAL LANGUAGES.
 *
 * There is no aggregate of them anywhere in the type graph — the ESLint rule on
 * aggregate identifiers is the backstop, and this module is where the separation is
 * actually enforced in behaviour.
 *
 *   Coverage   — an enum per MODULE: 'none' | 'covered'. Moved ONLY by the recall gate.
 *   Mastery    — derived at read time from auto-graded judgment evidence. Never stored.
 *   Confidence — 1-5 per MODULE, captured at most once per module per 14 days.
 */

export const CONFIDENCE_COOLDOWN_MS = 14 * 86_400_000

/** The recall gate's ONLY effect on progress. */
export async function markCovered(moduleId: ModuleId, now: number): Promise<void> {
  const existing = await progress.get(moduleId)
  await progress.put({
    moduleId,
    coverage: 'covered',
    coveredAt: existing?.coveredAt ?? now,
    confidence: existing?.confidence ?? null,
    confidenceAt: existing?.confidenceAt ?? null,
  })
}

/** Confidence, and nothing else. Refused inside the cooldown so it stays a signal. */
export async function recordConfidence(moduleId: ModuleId, value: number, now: number): Promise<boolean> {
  const existing = await progress.get(moduleId)
  if (existing?.confidenceAt != null && now - existing.confidenceAt < CONFIDENCE_COOLDOWN_MS) return false
  await progress.put({
    moduleId,
    coverage: existing?.coverage ?? 'none',
    coveredAt: existing?.coveredAt ?? null,
    confidence: value,
    confidenceAt: now,
  })
  return true
}

export async function shouldAskConfidence(moduleId: ModuleId, now: number): Promise<boolean> {
  const existing = await progress.get(moduleId)
  return existing?.confidenceAt == null || now - existing.confidenceAt >= CONFIDENCE_COOLDOWN_MS
}

export interface ModuleAxes {
  moduleId: ModuleId
  coverage: 'none' | 'covered'
  confidence: number | null
  /** Per claim. `value: null` means insufficient evidence — not zero. */
  mastery: { claimId: ClaimId; result: MasteryResult }[]
  /** The module reads as mastered only when EVERY claim clears the floor and 0.8. */
  masteredClaims: number
  claimsWithEvidence: number
  totalClaims: number
}

export async function moduleAxes(
  moduleId: ModuleId, claimIds: ClaimId[], now: number, tier: Tier = 'MVP',
): Promise<ModuleAxes> {
  const [row, all] = await Promise.all([progress.get(moduleId), attempts.byModule(moduleId)])
  const mastery = claimIds.map(claimId => ({ claimId, result: claimMastery(all, claimId, now, tier) }))
  return {
    moduleId,
    coverage: row?.coverage ?? 'none',
    confidence: row?.confidence ?? null,
    mastery,
    masteredClaims: mastery.filter(m => (m.result.value ?? 0) >= 0.8).length,
    claimsWithEvidence: mastery.filter(m => m.result.value != null).length,
    totalClaims: claimIds.length,
  }
}

/** For /progress: the review forecast, straight off the card due dates. */
export async function reviewForecast(now: number, days = 30): Promise<number[]> {
  const all = await cards.all()
  const buckets = new Array(days).fill(0) as number[]
  for (const c of all) {
    if (c.status !== 'active') continue
    const d = Math.floor((c.due - now) / 86_400_000)
    if (d < 0) buckets[0]! += 1
    else if (d < days) buckets[d]! += 1
  }
  return buckets
}

/**
 * Calibration: confidence against measured mastery, one point per module.
 * Points above y=x are the interesting ones — rated solid where mastery is unproven.
 */
export interface CalibrationPoint { moduleId: ModuleId; confidence: number; mastery: number }

export async function calibration(
  modules: { id: ModuleId; claimIds: ClaimId[]; tier: Tier }[], now: number,
): Promise<CalibrationPoint[]> {
  const rows = await progress.all()
  const byId = new Map(rows.map(r => [r.moduleId, r]))
  const out: CalibrationPoint[] = []
  for (const m of modules) {
    const row = byId.get(m.id)
    if (row?.confidence == null) continue
    const axes = await moduleAxes(m.id, m.claimIds, now, m.tier)
    const withValue = axes.mastery.map(x => x.result.value).filter((v): v is number => v != null)
    if (!withValue.length) continue
    out.push({
      moduleId: m.id,
      confidence: row.confidence / 5,
      mastery: withValue.reduce((s, v) => s + v, 0) / withValue.length,
    })
  }
  return out
}

export type { ModuleProgressRow, MasteryResult }
