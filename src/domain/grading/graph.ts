import type { Port, PaletteNode, GraphNode, GraphEdge, Graph, CanvasKey } from '@content/types'

export type { Port, PaletteNode, GraphNode, GraphEdge, Graph, CanvasKey }

/**
 * ARCHITECTURE GRADING — build once, use four ways.
 *
 * The same grader serves the `architecture-build` drill, the case study's Canvas
 * tab, and (from a later milestone) the mock's architecture phase. That is why it
 * lives in domain/grading rather than inside whichever feature happened to need it
 * first.
 *
 * Typed ports are what make a drawn architecture gradable at all: a palette of
 * fixed node types with declared port types means a connection is either meaningful
 * or refused, so the artifact is a graph rather than a picture.
 */

/** A connection is only offered when the port types match and the direction is right. */
export function canConnect(key: CanvasKey, from: GraphNode, fromPort: string, to: GraphNode, toPort: string): boolean {
  const a = key.palette.find(p => p.type === from.type)?.ports.find(p => p.id === fromPort)
  const b = key.palette.find(p => p.type === to.type)?.ports.find(p => p.id === toPort)
  if (!a || !b) return false
  if (a.dir !== 'out' || b.dir !== 'in') return false
  return a.type === b.type
}

const typeOf = (g: Graph, id: string) => g.nodes.find(n => n.id === id)?.type

export interface GradeBreakdown {
  score: number
  passed: boolean
  nodes: { got: number; want: number; missing: string[] }
  edges: { got: number; want: number; missing: [string, string][] }
  forbidden: string[]
  invariants: { id: string; label: string; ok: boolean }[]
  /** Set when the design scores zero for structural reasons, with the reason. */
  zeroedBecause?: string
}

/**
 * Score = 0.15·nodes + 0.70·edges + 0.10·(1 − forbidden) + 0.05·invariants
 *
 * Edges carry 0.70 because the EDGES are the architecture: placing the right boxes
 * and wiring none of them is not a partial design, it is a parts list. A graph with
 * zero required edges therefore scores 0 outright, however many nodes it has —
 * anything else is participation credit on the primary mastery mover for `design`.
 */
export function gradeGraph(g: Graph, key: CanvasKey): GradeBreakdown {
  const presentTypes = new Set(g.nodes.map(n => n.type))
  const missingNodes = key.requiredNodes.filter(t => !presentTypes.has(t))
  const nodeScore = key.requiredNodes.length
    ? (key.requiredNodes.length - missingNodes.length) / key.requiredNodes.length
    : 1

  const hasEdge = ([a, b]: [string, string]) =>
    g.edges.some(e => typeOf(g, e.from) === a && typeOf(g, e.to) === b)
  const missingEdges = key.requiredEdges.filter(pair => !hasEdge(pair))
  const gotEdges = key.requiredEdges.length - missingEdges.length
  const edgeScore = key.requiredEdges.length ? gotEdges / key.requiredEdges.length : 1

  const forbidden = key.forbiddenEdges
    .filter(hasEdge)
    .map(([a, b]) => `${a} → ${b}`)
  const forbiddenScore = key.forbiddenEdges.length
    ? 1 - forbidden.length / key.forbiddenEdges.length
    : 1

  const invariants = key.invariants.map(i => ({ id: i.id, label: i.label, ok: i.holds(g, key) }))
  const invScore = invariants.length ? invariants.filter(i => i.ok).length / invariants.length : 1

  let score = 0.15 * nodeScore + 0.70 * edgeScore + 0.10 * forbiddenScore + 0.05 * invScore
  let zeroedBecause: string | undefined

  if (key.requiredEdges.length > 0 && gotEdges === 0) {
    score = 0
    zeroedBecause = 'None of the required connections are present. The boxes are not the design — the edges are.'
  }

  const brokenCritical = key.invariants.filter(i => i.critical && !i.holds(g, key))
  if (brokenCritical.length) {
    score = 0
    zeroedBecause = `${brokenCritical.map(i => i.label).join('; ')} — that is the thing this design is about.`
  }

  return {
    score: Number(score.toFixed(4)),
    passed: score >= key.passThreshold,
    nodes: { got: key.requiredNodes.length - missingNodes.length, want: key.requiredNodes.length, missing: missingNodes },
    edges: { got: gotEdges, want: key.requiredEdges.length, missing: missingEdges },
    forbidden,
    invariants,
    zeroedBecause,
  }
}

/** Used by lint and by every case study's own test. */
export function validateKey(key: CanvasKey): string[] {
  const problems: string[] = []
  if (key.acceptedVariants.length < 2) {
    problems.push(`only ${key.acceptedVariants.length} acceptedVariant(s): a key that admits one shape teaches "guess my diagram", not architecture`)
  }
  key.acceptedVariants.forEach((v, i) => {
    const g = gradeGraph(v, key)
    if (!g.passed) problems.push(`acceptedVariant[${i}] scores ${g.score} but passThreshold is ${key.passThreshold}`)
  })
  for (const n of key.requiredNodes) {
    if (!key.palette.some(p => p.type === n)) problems.push(`requiredNodes lists "${n}", which is not in the palette`)
  }
  return problems
}
