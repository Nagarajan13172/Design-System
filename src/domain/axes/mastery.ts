import { JUDGMENT_VERBS, MASTERY_KINDS } from '@content/types'
import type { ClaimId, Tier } from '@content/types'
import type { MasteryInput, Attempt } from '../grading/types'

/**
 * MASTERY — one of three axes, with its own unit and its own visual language.
 * There is no aggregate of the three anywhere in the type graph; the ESLint rule
 * `no-restricted-syntax` on aggregate identifiers is the backstop.
 */

/** The single mastery gate. Everything else routes through this. */
export function masteryContribution(i: MasteryInput): number | null {
  if (i.grading.kind !== 'auto') return null
  if (!(JUDGMENT_VERBS as readonly string[]).includes(i.verb)) return null
  if (!(MASTERY_KINDS as readonly string[]).includes(i.itemKind)) return null
  if (i.rehearsal) return null
  return i.grading.score
}

/** Half-life in days, by tier. Advanced material decays faster because it is used less. */
const HALF_LIFE: Record<Tier, number> = { MVP: 120, tier2: 90, tier3: 60 }

export interface MasteryResult {
  /** null means INSUFFICIENT EVIDENCE. Not 0, not a number — a refusal to render one. */
  value: number | null
  itemCount: number
  kindCount: number
  reason?: string
}

/**
 * Beta posterior with continuous time decay:
 *   (Σ wᵢ·sᵢ·dᵢ + 1) / (Σ wᵢ·dᵢ + 2),  dᵢ = 0.5^(Δdays / halfLife)
 *
 * Anti-farming: the same item repeated inside 30 days is weighted x0.5, then x0.25.
 * A claim cannot exceed 0.85 from a single item kind — grinding one drill type is
 * not mastery, and the cap is what says so.
 *
 * EVIDENCE FLOOR: below 3 distinct items across 2 distinct kinds this returns null
 * and the UI prints "insufficient evidence". A number computed from one mcq is worse
 * than no number, because the learner believes it.
 */
export function claimMastery(
  attempts: Attempt[], claimId: ClaimId, now: number, tier: Tier = 'MVP',
): MasteryResult {
  const relevant = attempts.filter(a => a.claimId === claimId && a.grading.kind === 'auto')
  const distinctItems = new Set(relevant.map(a => a.itemId))
  const distinctKinds = new Set(relevant.map(a => a.itemKind))

  if (distinctItems.size < 3 || distinctKinds.size < 2) {
    return {
      value: null, itemCount: distinctItems.size, kindCount: distinctKinds.size,
      reason: `insufficient evidence — ${distinctItems.size} item${distinctItems.size === 1 ? '' : 's'} across ${distinctKinds.size} kind${distinctKinds.size === 1 ? '' : 's'}, needs 3 across 2`,
    }
  }

  const halfLife = HALF_LIFE[tier]
  const seenItem = new Map<string, number>()
  let num = 1, den = 2
  const byKind = new Map<string, { num: number; den: number }>()

  for (const a of [...relevant].sort((x, y) => x.ts - y.ts)) {
    const g = a.grading
    if (g.kind !== 'auto') continue
    const seen = seenItem.get(a.itemId) ?? 0
    seenItem.set(a.itemId, seen + 1)
    const farmPenalty = seen === 0 ? 1 : seen === 1 ? 0.5 : 0.25
    const decay = Math.pow(0.5, (now - a.ts) / (halfLife * 86_400_000))
    const w = farmPenalty
    num += w * g.score * decay
    den += w * decay
    const k = byKind.get(a.itemKind) ?? { num: 1, den: 2 }
    k.num += w * g.score * decay; k.den += w * decay
    byKind.set(a.itemKind, k)
  }

  let value = num / den
  // Single-kind cap: if one kind supplies nearly all the evidence, cap at 0.85.
  const kindShares = [...byKind.values()].map(k => k.den - 2)
  const total = kindShares.reduce((s, v) => s + v, 0)
  // >80% of the weighted evidence from one kind is "from a single item kind".
  if (total > 0 && Math.max(...kindShares) / total > 0.8) value = Math.min(value, 0.85)

  return { value, itemCount: distinctItems.size, kindCount: distinctKinds.size }
}
