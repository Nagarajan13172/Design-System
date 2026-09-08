import type { QueueItem } from '@/domain/scheduler/queue'
import type { AttemptGrading } from '@/domain/grading/types'

/**
 * THE SESSION REDUCER. Pure, so the whole session lifecycle is testable without a
 * DOM, a clock or a database — the three things that make session bugs so hard to
 * reproduce from a bug report.
 */

export type Phase = 'deck' | 'running' | 'summary'

export interface Answered {
  cardId: string
  itemKind: QueueItem['itemKind']
  grading: AttemptGrading
  latencyMs: number
  /** A retry inside the same session. Never re-rated — see `retry` below. */
  rehearsal: boolean
}

export interface SessionState {
  phase: Phase
  queue: QueueItem[]
  /** Cards re-queued after a wrong answer, at +5 positions. */
  cursor: number
  startedAt: number
  cardStartedAt: number
  answered: Answered[]
  /** cardId -> true once it has been answered wrong at least once this session. */
  missed: Record<string, boolean>
  wrongThenRight: number
  budgetSeconds: number
  /** Set once, when the queue empties. Summary must not read a clock during render. */
  endedAt: number | null
}

export type SessionEvent =
  | { type: 'start'; queue: QueueItem[]; now: number; budgetSeconds: number }
  | { type: 'grade'; grading: AttemptGrading; now: number }
  | { type: 'skip'; now: number }
  | { type: 'end'; now: number }

export const initialSession: SessionState = {
  phase: 'deck', queue: [], cursor: 0, startedAt: 0, cardStartedAt: 0,
  answered: [], missed: {}, wrongThenRight: 0, budgetSeconds: 420, endedAt: null,
}

const isCorrect = (g: AttemptGrading) =>
  g.kind === 'auto' ? g.correct : g.kind === 'self-rating' ? g.rating >= 3 : false

export function reduce(s: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case 'start':
      return { ...initialSession, phase: 'running', queue: e.queue, startedAt: e.now, cardStartedAt: e.now, budgetSeconds: e.budgetSeconds }

    case 'grade': {
      const item = s.queue[s.cursor]
      if (!item || s.phase !== 'running') return s
      const rehearsal = !!s.missed[item.cardId]
      const answered: Answered = {
        cardId: item.cardId, itemKind: item.itemKind, grading: e.grading,
        latencyMs: e.now - s.cardStartedAt, rehearsal,
      }
      const correct = isCorrect(e.grading)
      const missed = correct ? s.missed : { ...s.missed, [item.cardId]: true }
      // Wrong-then-right is the number worth steering by: it means the session
      // taught something, as opposed to merely measuring what was already known.
      const wrongThenRight = correct && rehearsal ? s.wrongThenRight + 1 : s.wrongThenRight

      let queue = s.queue
      if (!correct) {
        // Re-enter at +5 so it is retested after interference, not immediately.
        const rest = queue.slice(s.cursor + 1)
        const at = Math.min(5, rest.length)
        queue = [...queue.slice(0, s.cursor + 1), ...rest.slice(0, at), item, ...rest.slice(at)]
      }

      const next = s.cursor + 1
      const done = next >= queue.length
      return {
        ...s, queue, answered: [...s.answered, answered], missed, wrongThenRight,
        cursor: next, cardStartedAt: e.now, phase: done ? 'summary' : 'running',
        endedAt: done ? e.now : null,
      }
    }

    case 'skip': {
      const next = s.cursor + 1
      const done = next >= s.queue.length
      return { ...s, cursor: next, cardStartedAt: e.now, phase: done ? 'summary' : 'running', endedAt: done ? e.now : null }
    }

    case 'end':
      return { ...s, phase: 'summary', endedAt: s.endedAt ?? e.now }
  }
}

/** Only FIRST attempts are rated. A within-session retry re-teaches; it does not re-measure. */
export const ratable = (a: Answered) => !a.rehearsal

export interface SessionSummary {
  graded: number
  correct: number
  wrongThenRight: number
  elapsedSeconds: number
  byVerbKind: { kind: string; correct: number; total: number }[]
  weakest: string[]
}

export function summarise(s: SessionState, now: number): SessionSummary {
  const first = s.answered.filter(ratable)
  const byKind = new Map<string, { correct: number; total: number }>()
  for (const a of first) {
    const k = byKind.get(a.itemKind) ?? { correct: 0, total: 0 }
    k.total++; if (isCorrect(a.grading)) k.correct++
    byKind.set(a.itemKind, k)
  }
  const wrongCards = [...new Set(s.answered.filter(a => !isCorrect(a.grading)).map(a => a.cardId))]
  return {
    graded: first.length,
    correct: first.filter(a => isCorrect(a.grading)).length,
    wrongThenRight: s.wrongThenRight,
    elapsedSeconds: Math.round((now - s.startedAt) / 1000),
    byVerbKind: [...byKind.entries()].map(([kind, v]) => ({ kind, ...v })),
    weakest: wrongCards.slice(0, 5),
  }
}
