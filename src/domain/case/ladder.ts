import type { CaseSpec } from '@content/types'
import type { CanvasKey, Graph } from '@/domain/grading/graph'

/**
 * THE LADDER'S RULES, separated from its UI so they can be asserted.
 *
 *   worked → faded → mini
 *
 * Each rung removes scaffolding. The last one also changes the CASE, because
 * running it on the walkthrough you just saw measures recall of the walkthrough.
 */
export type Rung = 'worked' | 'faded' | 'mini'

export const RUNG_MINUTES: Record<Rung, number | null> = {
  worked: null,   // untimed on purpose: thinking is the activity
  faded: 25,      // a soft clock — it reports, it does not cut you off
  mini: 13,       // hard: the point is working inside a bound
}

export const HINT_DELAY_SECONDS = 60
export const HINT_PENALTY = 0.1

/**
 * The faded rung pre-builds most of the design and blanks the load-bearing parts:
 * the edges the case actually turns on, left dangling.
 *
 * Which edges are removed is not arbitrary — REQUIRED edges go first, because a
 * required edge is precisely the thing being taught.
 */
export function fadeGraph(full: Graph, key: CanvasKey, remove = 3): { graph: Graph; danglingFrom: string[] } {
  const isRequired = (e: Graph['edges'][number]) => {
    const from = full.nodes.find(n => n.id === e.from)?.type
    const to = full.nodes.find(n => n.id === e.to)?.type
    return key.requiredEdges.some(([a, b]) => a === from && b === to)
  }
  const ordered = [...full.edges].sort((a, b) => Number(isRequired(b)) - Number(isRequired(a)))
  const dropped = ordered.slice(0, Math.min(remove, ordered.length))
  const keep = full.edges.filter(e => !dropped.includes(e))
  return { graph: { nodes: full.nodes, edges: keep }, danglingFrom: dropped.map(e => e.from) }
}

/** A hint costs a fixed fraction, so taking three is visibly not the same as taking none. */
export const scoreAfterHints = (score: number, hints: number) =>
  Math.max(0, Number((score - hints * HINT_PENALTY).toFixed(4)))

export interface PairingProblem { kind: string; detail: string }

/**
 * THE PAIRING RULE.
 *
 * Two cases are a valid worked/independent pair when they share STRUCTURE and differ
 * in SURFACE. Comparing palette labels would call any two cases with a "cache" node
 * analogous — which is exactly the mistake that turns the ladder into a rehearsal.
 */
export function checkPairing(
  a: CaseSpec, b: CaseSpec, keyA: CanvasKey, keyB: CanvasKey,
): PairingProblem[] {
  const problems: PairingProblem[] = []

  const shared = a.structureTags.filter(t => b.structureTags.includes(t))
  if (shared.length < 3) {
    problems.push({ kind: 'not-analogous', detail: `${a.id} and ${b.id} share only ${shared.length} structure tag(s); a pair needs 3+ or the transfer is a guess` })
  }

  if (a.id === b.id) {
    problems.push({ kind: 'same-case', detail: 'the independent rung must not run on the case that was walked through' })
  }

  // Structurally the same SHAPE of key...
  const shapeA = keyA.requiredEdges.length + keyA.invariants.filter(i => i.critical).length
  const shapeB = keyB.requiredEdges.length + keyB.invariants.filter(i => i.critical).length
  if (Math.abs(shapeA - shapeB) > 2) {
    problems.push({ kind: 'uneven', detail: `key complexity differs too much (${shapeA} vs ${shapeB}) for one to prepare you for the other` })
  }

  // ...but NOT the same surface. Near-identical palettes mean it is the same case
  // wearing a different prompt.
  const typesA = new Set(keyA.palette.map(p => p.type))
  const typesB = keyB.palette.map(p => p.type)
  const overlap = typesB.filter(t => typesA.has(t)).length / Math.max(1, typesB.length)
  if (overlap > 0.8) {
    problems.push({ kind: 'too-similar', detail: `${Math.round(overlap * 100)}% of the palette is shared — this is the same case, not an analogous one` })
  }

  return problems
}
