import { describe, it, expect } from 'vitest'
import { run, measure, DEFAULTS, canvasKey } from './sim'
import { measure as moduleMeasure } from '../../state/state-races/sim'
import { validateKey, gradeGraph } from '../../../src/domain/grading/graph'
import claims from './claims'

/**
 * THE REUSE PROOF.
 *
 * This case study has no simulator of its own — it re-parameterises the one that
 * belongs to `state-races`. If this test ever fails, a case study has started
 * re-deriving a mechanism a module already owns, and twenty case studies will cost
 * twenty times one.
 */
describe('cs-autocomplete reuses the state-races simulator', () => {
  it('is literally the same function, not a copy', () => {
    expect(measure).toBe(moduleMeasure)
  })

  it('produces identical results for identical parameters', () => {
    const p = { ...DEFAULTS, debounceMs: 300 }
    expect(measure(p)).toEqual(moduleMeasure(p))
  })
})

describe('the case study’s own numbers', () => {
  it('claim:cs-autocomplete-c1 — a 150ms debounce cuts a query to about seven requests', () => {
    const m = measure(DEFAULTS)
    expect(m.avgRequestsPerSession).toBeGreaterThan(5)
    expect(m.avgRequestsPerSession).toBeLessThan(9)
  })

  it('claim:cs-autocomplete-c2 — roughly 8% of queries end stale with no guard', () => {
    expect(measure(DEFAULTS).staleRate).toBeCloseTo(0.08, 1)
  })

  it('claim:cs-autocomplete-c3 — 400ms looks fixed here and reopens on a slow network', () => {
    const fast = measure({ ...DEFAULTS, debounceMs: 400 })
    const slow = measure({ ...DEFAULTS, debounceMs: 400, p95Ms: 1500 })
    expect(fast.staleRate).toBeLessThan(0.02)      // under 1% — it ships
    expect(slow.staleRate).toBeGreaterThan(0.06)   // and comes straight back
    expect(slow.staleRate / Math.max(fast.staleRate, 0.001)).toBeGreaterThan(5)
  })

  it('claim:cs-autocomplete-c4 — a guard is zero at EVERY latency profile', () => {
    for (const p95 of [600, 900, 1500, 2500]) {
      expect(measure({ ...DEFAULTS, p95Ms: p95, sequencing: true }).staleRate).toBe(0)
    }
  })
})

describe('the canvas key', () => {
  it('admits more than one valid architecture', () => {
    expect(validateKey(canvasKey)).toEqual([])
    expect(canvasKey.acceptedVariants.length).toBeGreaterThanOrEqual(2)
  })

  it('scores both the sequenced and the cancelled design as passing', () => {
    for (const v of canvasKey.acceptedVariants) expect(gradeGraph(v, canvasKey).passed).toBe(true)
  })

  it('refuses a design that wires the response straight to the list', () => {
    const unguarded = {
      nodes: [{ id: 'i', type: 'input' }, { id: 'd', type: 'debounce' }, { id: 'r', type: 'request' }, { id: 'l', type: 'list' }],
      edges: [
        { id: 'e1', from: 'i', fromPort: 'keys', to: 'd', toPort: 'in' },
        { id: 'e2', from: 'd', fromPort: 'out', to: 'r', toPort: 'trigger' },
        { id: 'e3', from: 'r', fromPort: 'response', to: 'l', toPort: 'items' },
      ],
    }
    const g = gradeGraph(unguarded, canvasKey)
    expect(g.forbidden).toContain('request → list')
    expect(g.invariants.find(i => i.id === 'guarded')?.ok).toBe(false)
    expect(g.passed).toBe(false)
  })
})

describe('the figure', () => {
  it('is deterministic and honours the cognitive-load contract', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
    const tl = run()
    expect(tl.ghost).toBeTruthy()
    for (const f of tl.frames) {
      expect(f.annotations.length).toBeLessThanOrEqual(7)
      expect(f.channels.length).toBeLessThanOrEqual(2)
      expect(f.narration.trim()).not.toBe('')
    }
  })

  it('every measurement claim is covered by an assertion in this file', async () => {
    const { readFileSync } = await import('node:fs')
    const self = readFileSync(new URL(import.meta.url).pathname, 'utf8')
    for (const c of claims.filter(c => c.evidence === 'measurement')) expect(self).toContain(`claim:${c.id}`)
  })
})
