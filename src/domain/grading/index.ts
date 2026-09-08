import type { Item, ItemKind } from '@content/types'
import type { AutoGrading, AttemptGrading } from './types'

/**
 * ONE HOME FOR GRADING.
 *
 * `gradeAttempt` is pure, has no React import, and is imported by the drill
 * renderers, the figure's prediction gate, and (from M6) the case Canvas tab. The
 * CanvasKey grader in particular is build-once-use-four-ways, which is why grading
 * does not live inside the features that happen to call it first.
 */

export type Response =
  | { kind: 'cloze'; values: string[] }
  | { kind: 'mcq-rationale'; option: number; rationale: number }
  | { kind: 'order-steps'; order: number[] }
  | { kind: 'constraint-flip'; direction: string; band: number }
  | { kind: 'spot-the-failure'; region: string; failureClass: string }
  | { kind: 'predict'; value: number | string | string[] }
  | { kind: 'claim-recall'; rating: 1 | 2 | 3 | 4 }

const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ')

/** Edit distance <= 2 counts as correct; the correction is shown, not silently accepted. */
export function withinEditDistance(a: string, b: string, max = 2): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > max) return false
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length]![b.length]! <= max
}

/** Normalised Kendall tau, but inverting any authored hardOrder pair zeroes it. */
export function kendall(order: number[], hardOrder: [number, number][] = []): number {
  const n = order.length
  if (n < 2) return 1
  for (const [a, b] of hardOrder) {
    if (order.indexOf(a) > order.indexOf(b)) return 0
  }
  let concordant = 0, total = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      total++
      if (order.indexOf(i) < order.indexOf(j)) concordant++
    }
  }
  return total ? concordant / total : 1
}

export interface GradeResult {
  grading: AutoGrading
  /** What the learner is shown. Never the word "incorrect" on its own. */
  explanation?: string
  /** For predict: which stage of the figure to scrub to. */
  divergesAtStage?: number
}

type Payload = Record<string, unknown>

export function gradeAttempt(item: Item, response: Response, latencyMs: number): GradeResult {
  const p = (item.payload ?? {}) as Payload
  const auto = (correct: boolean, score: number): AutoGrading => ({ kind: 'auto', correct, score, latencyMs })

  switch (response.kind) {
    case 'cloze': {
      const blanks = (p.blanks as string[]) ?? []
      const accept = (p.accept as Record<string, string[]>) ?? {}
      const marks = blanks.map((b, i) => {
        const alts = [b, ...(accept[i] ?? accept[String(i)] ?? [])].map(norm)
        return alts.some(a => withinEditDistance(norm(response.values[i] ?? ''), a))
      })
      const score = marks.length ? marks.filter(Boolean).length / marks.length : 0
      return { grading: auto(marks.every(Boolean), score) }
    }

    case 'mcq-rationale': {
      // Two required screens. Right answer / wrong reason scores 0.4 and is reported
      // distinctly — it is the most useful signal in the whole item set.
      const optOk = response.option === p.correct
      const whyOk = response.rationale === p.correctRationale
      const score = optOk && whyOk ? 1 : optOk ? 0.4 : 0
      return {
        grading: auto(optOk && whyOk, score),
        explanation: optOk && !whyOk
          ? 'Right answer, wrong reason. That is worth knowing: the conclusion was reachable without the mechanism.'
          : optOk ? 'Right, for the right reason.' : undefined,
      }
    }

    case 'order-steps': {
      const hard = (p.hardOrder as [number, number][]) ?? []
      const score = kendall(response.order, hard)
      return {
        grading: auto(score === 1, score),
        explanation: score === 0 && hard.length ? 'One of the orderings here is causal, not preferential — reversing it makes the sequence impossible.' : undefined,
      }
    }

    case 'constraint-flip': {
      // THE WORKHORSE. Direction 0.6, threshold band 0.4 — it makes trade-off
      // judgment gradable in forty seconds.
      const dirOk = response.direction === p.direction
      const bandOk = response.band === p.correctBand
      const score = (dirOk ? 0.6 : 0) + (bandOk ? 0.4 : 0)
      return {
        grading: auto(dirOk && bandOk, score),
        explanation: dirOk && !bandOk
          ? `Direction right, magnitude off. The parameter that decides it is ${String(p.flipParameter ?? 'the one that changed')}.`
          : !dirOk ? `The flip runs the other way. Watch ${String(p.flipParameter ?? 'the changed parameter')}.` : undefined,
      }
    }

    case 'spot-the-failure': {
      const hit = response.region === p.hitRegion
      const classOk = response.failureClass === p.failureClass
      const score = (hit ? 0.5 : 0) + (classOk ? 0.5 : 0)
      return {
        grading: auto(hit && classOk, score),
        explanation: !hit ? String(p.adjacentHint ?? 'The symptom and the cause are in different places here.') : undefined,
      }
    }

    case 'predict': {
      const control = p.control as string
      if (control === 'point') {
        const correct = Number(p.correct)
        const tol = (p.tolerance as { abs?: number; rel?: number }) ?? { abs: 1 }
        const v = Number(response.value)
        const within = tol.abs != null ? Math.abs(v - correct) <= tol.abs
          : Math.abs(v - correct) / Math.max(1e-9, Math.abs(correct)) <= (tol.rel ?? 0.2)
        return { grading: auto(within, within ? 1 : 0), divergesAtStage: within ? undefined : 1 }
      }
      if (control === 'rank') {
        const correct = (p.correct as string[]) ?? []
        const given = Array.isArray(response.value) ? response.value : []
        const exact = given.length === correct.length && given.every((x, i) => x === correct[i])
        const top1 = given[0] === correct[0]
        return { grading: auto(exact, exact ? 1 : top1 ? 0.5 : 0), divergesAtStage: exact ? undefined : 2 }
      }
      const ok = String(response.value) === String(p.correct)
      return { grading: auto(ok, ok ? 1 : 0), divergesAtStage: ok ? undefined : 1 }
    }

    case 'claim-recall': {
      // Not auto-graded. The caller routes this through fromSelfRating(), never here.
      throw new Error('claim-recall is self-rated: route it through fromSelfRating(), not gradeAttempt()')
    }
  }
}

/** Item kinds this dispatcher can grade. `claim-recall`, `free-recall` and `tradeoff-defense` cannot be. */
export const AUTO_GRADABLE: ItemKind[] = [
  'cloze', 'mcq-rationale', 'order-steps', 'constraint-flip', 'spot-the-failure', 'predict', 'code-cloze', 'code-diff',
]

export type { AttemptGrading }
