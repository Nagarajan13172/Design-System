import { describe, it, expect } from 'vitest'
import { fadeGraph, scoreAfterHints, checkPairing, RUNG_MINUTES, HINT_PENALTY } from './ladder'
import autocomplete from '@content/cs/cs-autocomplete/case'
import logTail from '@content/cs/cs-log-tail/case'
import { gradeGraph, validateKey } from '@/domain/grading/graph'

describe('the rungs remove scaffolding in order', () => {
  it('worked is untimed, faded is soft, mini is hard', () => {
    expect(RUNG_MINUTES.worked).toBeNull()
    expect(RUNG_MINUTES.faded).toBeGreaterThan(RUNG_MINUTES.mini!)
  })

  it('the worked rung has decision points and the independent rung has none', () => {
    expect(autocomplete.decisionPoints.length).toBe(6)
    // Showing the reasoning on the independent rung would make it a walkthrough.
    expect(logTail.decisionPoints.length).toBe(0)
  })
})

describe('fading', () => {
  const full = autocomplete.canvasKey.acceptedVariants[0]!

  it('removes the REQUIRED edges first — they are what is being taught', () => {
    const { graph } = fadeGraph(full, autocomplete.canvasKey, 2)
    const remaining = gradeGraph(graph, autocomplete.canvasKey)
    expect(remaining.edges.got).toBeLessThan(autocomplete.canvasKey.requiredEdges.length)
  })

  it('leaves the rest of the design standing', () => {
    const { graph } = fadeGraph(full, autocomplete.canvasKey, 2)
    expect(graph.nodes).toEqual(full.nodes)
    expect(graph.edges.length).toBe(full.edges.length - 2)
  })

  it('reports which nodes are left dangling, so the gap is visible', () => {
    const { danglingFrom } = fadeGraph(full, autocomplete.canvasKey, 3)
    expect(danglingFrom).toHaveLength(3)
  })

  it('the un-faded design still passes — fading is the only thing that broke it', () => {
    expect(gradeGraph(full, autocomplete.canvasKey).passed).toBe(true)
  })
})

describe('hints are subtracted', () => {
  it('costs a fixed fraction each, so three hints is visibly not none', () => {
    expect(scoreAfterHints(1, 0)).toBe(1)
    expect(scoreAfterHints(1, 1)).toBeCloseTo(1 - HINT_PENALTY)
    expect(scoreAfterHints(1, 3)).toBeCloseTo(1 - 3 * HINT_PENALTY)
  })
  it('never goes below zero', () => {
    expect(scoreAfterHints(0.2, 9)).toBe(0)
  })
})

/**
 * THE PAIRING RULE — the thing that makes this a ladder rather than a rehearsal.
 */
describe('worked / independent pairing', () => {
  it('accepts a genuinely analogous pair', () => {
    expect(checkPairing(autocomplete, logTail, autocomplete.canvasKey, logTail.canvasKey)).toEqual([])
  })

  it('rejects running the independent rung on the same case', () => {
    const p = checkPairing(autocomplete, autocomplete, autocomplete.canvasKey, autocomplete.canvasKey)
    expect(p.map(x => x.kind)).toContain('same-case')
    // ...and catches it a second way: an identical palette is the same case.
    expect(p.map(x => x.kind)).toContain('too-similar')
  })

  it('rejects a pair that merely shares vocabulary', () => {
    const unrelated = { ...logTail, structureTags: ['forms', 'validation'] }
    expect(checkPairing(autocomplete, unrelated, autocomplete.canvasKey, logTail.canvasKey)
      .map(x => x.kind)).toContain('not-analogous')
  })

  it('compares the SEMANTIC key, not the palette labels', () => {
    // Same tags, wildly different key complexity: not a usable rung.
    const trivial = {
      ...logTail.canvasKey,
      requiredEdges: [] as [string, string][],
      invariants: [],
    }
    expect(checkPairing(autocomplete, logTail, autocomplete.canvasKey, trivial)
      .map(x => x.kind)).toContain('uneven')
  })

  it('every declared partner is itself a valid, gradable case', () => {
    for (const spec of [autocomplete, logTail]) {
      expect(validateKey(spec.canvasKey), spec.id).toEqual([])
      expect(spec.ledger.every(l => l.flipsWhen.length > 10), `${spec.id} ledger`).toBe(true)
      expect(spec.subsystems.length, `${spec.id} subsystems`).toBeGreaterThan(0)
    }
  })

  it('the pairing is declared in both directions', () => {
    expect(autocomplete.independentPartner).toBe(logTail.id)
    expect(logTail.independentPartner).toBe(autocomplete.id)
  })
})
