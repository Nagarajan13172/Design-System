import type { ClaimId, FigureId, ItemId, ItemKind, ModuleId } from '@content/types'
import type { AttemptGrading } from '@/domain/grading/types'

/**
 * The durable schema. Review history IS the product's value, so every change here
 * needs a migration step and a committed fixture — see migrations.ts.
 */
export const SCHEMA_VERSION = 2

/** One card per claim, 1:1, forever. `type CardId = ClaimId`. */
export type CardId = ClaimId

export type FsrsState = 0 | 1 | 2 | 3 // New | Learning | Review | Relearning

export interface CardRow {
  id: CardId
  moduleId: ModuleId
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: FsrsState
  last_review: number | null
  /**
   * A semantic content edit mints a new claim id and RETIRES the old card. A state,
   * not a parallel boolean, so it cannot disagree with itself.
   */
  status: 'active' | 'retired'
  supersededBy?: ClaimId
}

/** Append-only. Every review stores the full pre/post snapshot so the scheduler is swappable. */
export interface ReviewRow {
  id: string
  cardId: CardId
  ts: number
  rating: 1 | 2 | 3 | 4
  itemId: ItemId
  itemKind: ItemKind
  latencyMs: number
  pre: Omit<CardRow, 'id' | 'moduleId' | 'status'>
  post: Omit<CardRow, 'id' | 'moduleId' | 'status'>
}

/** Append-only. The evidence Mastery is computed from at read time. */
export interface AttemptRow {
  id: string
  itemId: ItemId
  moduleId: ModuleId
  claimId: ClaimId
  itemKind: ItemKind
  ts: number
  grading: AttemptGrading
  rehearsal: boolean
}

/** Immutable once written. The gate depends on it. */
export interface PredictionRow {
  figureId: FigureId
  moduleId: ModuleId
  value: number | string | string[]
  confidence: number
  committedAt: number
}

/** Coverage and Confidence: two of the three axes, per MODULE. Mastery is derived, never stored. */
export interface ModuleProgressRow {
  moduleId: ModuleId
  coverage: 'none' | 'covered'
  coveredAt: number | null
  confidence: number | null
  confidenceAt: number | null
}

export interface SessionRow {
  id: string
  startedAt: number
  endedAt: number | null
  budgetSeconds: number
  graded: number
  correct: number
  /** Cards answered wrong then right in the same session — the number worth steering by. */
  wrongThenRight: number
}

export interface PrefsRow {
  key: string
  value: unknown
}

/**
 * A locked Trade-off Defence. Added in schema v2.
 *
 * Deliberately NOT a card: the articulation queue is a fixed 14-day interval,
 * structurally isolated from FSRS. Routing a self-scored argument through the
 * scheduler is the constraint-C breach this design exists to prevent.
 */
export interface DefenceRow {
  id: string
  promptId: string
  moduleId: ModuleId
  choiceId: string
  flipParameter: string | null
  text: string
  textHash: string
  lockedAt: number
  words: number
  overtimeSeconds: number
  selfScores: Record<string, number>
  evidence: Record<string, string>
  /** Computed at lock time. The number the re-surface compares against. */
  criteriaWithEvidence: number
  /** When this comes back. Fixed interval, not scheduled. */
  dueAt: number
  /** Set once the learner has written a second answer and compared. */
  revisitedAt: number | null
  revisitCriteriaWithEvidence: number | null
}

export interface FesdSchema {
  cards: { key: CardId; value: CardRow; indexes: { 'by-due': number; 'by-module': ModuleId } }
  reviews: { key: string; value: ReviewRow; indexes: { 'by-card': CardId; 'by-ts': number } }
  attempts: { key: string; value: AttemptRow; indexes: { 'by-claim': ClaimId; 'by-ts': number; 'by-module': ModuleId } }
  predictions: { key: FigureId; value: PredictionRow }
  progress: { key: ModuleId; value: ModuleProgressRow }
  sessions: { key: string; value: SessionRow; indexes: { 'by-started': number } }
  prefs: { key: string; value: PrefsRow }
  defences: { key: string; value: DefenceRow; indexes: { 'by-due': number; 'by-module': ModuleId } }
}

export type StoreName = keyof FesdSchema
export const STORES: StoreName[] = ['cards', 'reviews', 'attempts', 'predictions', 'progress', 'sessions', 'prefs', 'defences']
