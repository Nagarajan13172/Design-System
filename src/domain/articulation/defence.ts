import { tokenPresence, wordCount } from '@/domain/grading/tokens'
import type { Criterion, DefencePrompt, DefenceRecord } from './types'
import { WORD_FLOOR } from './types'

/**
 * The parts of a defence that are COMPUTED rather than self-reported. Everything
 * here is deterministic and testable; the self-scores are not, which is exactly why
 * they are kept separate.
 */

/** A stable content hash. Lock stores it; any later edit fails to match. */
export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export interface CriterionReport {
  criterion: Criterion
  /** All concept-token groups present in the learner's own text. */
  hasEvidence: boolean
  missing: string[][]
}

export function reportCriteria(prompt: DefencePrompt, text: string): CriterionReport[] {
  return prompt.criteria.map(criterion => {
    const r = tokenPresence(text, criterion.conceptTokens)
    return { criterion, hasEvidence: r.allPresent, missing: r.missing }
  })
}

/** The number the +14 day re-surface reports. Auto-computed — never self-reported. */
export const criteriaWithEvidence = (prompt: DefencePrompt, text: string) =>
  reportCriteria(prompt, text).filter(r => r.hasEvidence).length

export const meetsFloor = (text: string) => wordCount(text) >= WORD_FLOOR

/**
 * A red-flagged criterion — one whose concept tokens are absent — cannot be scored
 * above zero without a SELECTED SPAN of the learner's own text as evidence, and the
 * span has to actually appear in what they wrote.
 *
 * This is the difference between a rubric and a fig leaf: without it, self-scoring
 * a flagged criterion is exactly as easy as scoring an unflagged one.
 */
export function canScoreAbove(
  report: CriterionReport, proposed: number, evidence: string | undefined, text: string,
): { allowed: boolean; reason?: string } {
  if (proposed === 0) return { allowed: true }
  if (report.hasEvidence) return { allowed: true }
  const span = evidence?.trim() ?? ''
  if (span.length < 12) {
    return { allowed: false, reason: 'Select the part of your own answer that covers this. Nothing you wrote resembles it.' }
  }
  if (!text.toLowerCase().includes(span.toLowerCase())) {
    return { allowed: false, reason: 'That text does not appear in your answer.' }
  }
  return { allowed: true }
}

/** After Lock, the text is frozen. Any client path that mutates it is detectable. */
export async function verifyUnedited(record: DefenceRecord): Promise<boolean> {
  return (await hashText(record.text)) === record.textHash
}

export interface Comparison {
  then: number
  now: number
  total: number
  delta: number
}

/**
 * The day-14 re-surface: write a NEW answer first, then compare. Showing the old
 * answer before the new one is written turns a retrieval act into an editing one.
 */
export function compare(prompt: DefencePrompt, thenText: string, nowText: string): Comparison {
  const then = criteriaWithEvidence(prompt, thenText)
  const now = criteriaWithEvidence(prompt, nowText)
  return { then, now, total: prompt.criteria.length, delta: now - then }
}
