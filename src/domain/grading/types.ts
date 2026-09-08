import type { ClaimId, ItemId, ItemKind, ModuleId, ObjectiveVerb } from '@content/types'

/**
 * THE SELF-REPORT FIREWALL.
 *
 * Constraint C says self-scored answers must never reach the scheduler or Mastery.
 * That is enforced here by the type system rather than by review discipline:
 *
 *   - `scheduler.next()` accepts ONLY a branded `DerivedRating`.
 *   - Exactly two functions produce one: `deriveRating(auto)` and `fromSelfRating(self-rating)`.
 *   - THERE IS NO FUNCTION THAT ACCEPTS `{ kind: 'self' }`.
 *
 * So routing a self-scored long-form answer into the scheduler is a compile error,
 * not a code-review comment. The previous design had a `firstIntervalHint` that let
 * a learner's self-score of their own prose set a card interval — the constraint-C
 * breach dressed as compliance. This shape makes that unrepresentable.
 */

/** Auto-graded: the machine decided, from a key. */
export interface AutoGrading {
  kind: 'auto'
  correct: boolean
  /** 0..1. Partial credit is real (mcq-rationale scores 0.4 for right-answer/wrong-reason). */
  score: number
  latencyMs: number
}

/** The learner marked their own free-text answer against criteria. Evidence, never a grade. */
export interface SelfGrading {
  kind: 'self'
  criteriaHit: number
  criteriaTotal: number
}

/** The learner rated their own recall. Feeds the SCHEDULER only, never Mastery. */
export interface SelfRatingGrading {
  kind: 'self-rating'
  rating: 1 | 2 | 3 | 4
}

export type AttemptGrading = AutoGrading | SelfGrading | SelfRatingGrading

declare const RATING_BRAND: unique symbol
/**
 * The only thing `scheduler.next()` will accept. Unforgeable outside this module:
 * a bare `3` does not typecheck.
 */
export type DerivedRating = (1 | 2 | 3 | 4) & { readonly [RATING_BRAND]: 'derived' }

const brand = (n: 1 | 2 | 3 | 4): DerivedRating => n as DerivedRating

/**
 * Auto-graded evidence becomes a rating from CORRECTNESS AND LATENCY, compared
 * against the learner's own rolling p75 for that item kind — not against a constant,
 * because "fast" for an architecture-build is slow for a cloze.
 */
export function deriveRating(g: AutoGrading, p75ForKind: number): DerivedRating {
  if (!g.correct) return brand(1)                       // again
  if (g.score < 0.6) return brand(2)                    // hard — right-ish, wrong reason
  if (p75ForKind > 0 && g.latencyMs > p75ForKind) return brand(3)  // good, but laboured
  return brand(g.score >= 0.99 ? 4 : 3)                 // easy only when clean and quick
}

/** The ONLY other door. `claim-recall` is the only card kind that uses it. */
export function fromSelfRating(g: SelfRatingGrading): DerivedRating {
  return brand(g.rating)
}

// NOTE: there is deliberately no `fromSelfGrading`. If you are here because you want
// one, the answer is no — see constraint C and the standing firewall test.

/**
 * The single gate on Mastery. Returns null unless ALL of:
 *   - the grading is auto (no self-report, in any form)
 *   - the module's objective verb is a judgment verb
 *   - the item kind is in MASTERY_KINDS
 *   - this is not a rehearsal (a repeat of the same item inside the anti-farming window)
 */
export interface MasteryInput {
  grading: AttemptGrading
  verb: ObjectiveVerb
  itemKind: ItemKind
  rehearsal: boolean
}

export interface Attempt {
  id: string
  itemId: ItemId
  moduleId: ModuleId
  claimId: ClaimId
  itemKind: ItemKind
  ts: number
  grading: AttemptGrading
  rehearsal: boolean
}
