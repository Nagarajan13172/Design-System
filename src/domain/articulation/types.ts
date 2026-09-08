import type { ClaimId, ModuleId } from '@content/types'

/**
 * TRADE-OFF DEFENCE — the articulation surface.
 *
 * Frontend system design interviews are won by ARTICULATING trade-offs under a
 * clock, and a click-based app cannot measure that. This is the one mechanism in
 * the product that trains it, so it is engineered rather than gestured at:
 *
 *   1. forced choice — there is no "it depends" option
 *   2. a timed, locked written justification
 *   3. Lock hashes the text; it cannot be edited afterwards
 *   4. reveal criteria with anchors at three quality levels
 *   5. self-score with evidence highlighting, and a red-flagged criterion cannot be
 *      scored above zero without selecting a span of the learner's OWN text
 *
 * What it measures honestly: whether the reasoning was written down at all, and
 * whether it contains the load-bearing concepts. What it cannot measure: whether the
 * argument is good. Mastery therefore never moves from this — the scores are
 * evidence for the learner, kept on the separate confidence axis.
 */

export interface DefenceOption {
  id: string
  label: string
  /**
   * The parameter that would flip the answer. The ONLY escape hatch from a forced
   * choice: a learner who wants to say "it depends" must name what it depends on.
   */
  flipParameter?: string
}

export interface Criterion {
  id: string
  /** What a good answer establishes. */
  label: string
  /** AND-of-ORs. Absence flags the criterion; presence is never a score. */
  conceptTokens: string[][]
  /** Three worked answers, so self-scoring has something to calibrate against. */
  anchors: { weak: string; adequate: string; strong: string }
}

export interface DefencePrompt {
  id: string
  moduleId: ModuleId
  claimId: ClaimId
  situation: string
  question: string
  /** Lint-blocked from containing an "it depends" option. */
  options: DefenceOption[]
  criteria: Criterion[]
  modelAnswer: string
}

export type DefencePhase = 'choose' | 'write' | 'reveal' | 'done'

export interface DefenceRecord {
  promptId: string
  choiceId: string
  flipParameter: string | null
  text: string
  /** Hash of the text at Lock. Any later edit is detectable and refused. */
  textHash: string
  lockedAt: number
  words: number
  overtimeSeconds: number
  /** 0-3 per criterion, self-assigned after the reveal. */
  selfScores: Record<string, number>
  /** Spans the learner selected as evidence for a flagged criterion. */
  evidence: Record<string, string>
  /** Computed, not self-reported: how many criteria had their tokens present. */
  criteriaWithEvidence: number
}

export const WRITE_SECONDS = 240
export const WORD_FLOOR = 60
export const ARTICULATION_INTERVAL_DAYS = 14
