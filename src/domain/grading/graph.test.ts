import { describe, it, expect } from 'vitest'
import { gradeGraph, canConnect, validateKey, type CanvasKey, type Graph } from './graph'

/** A small typeahead key: input → debounce → request → cache → list. */
const key: CanvasKey = {
  palette: [
    { type: 'input', label: 'search input', ports: [{ id: 'keystrokes', type: 'events', dir: 'out' }] },
    { type: 'debounce', label: 'debounce', ports: [{ id: 'in', type: 'events', dir: 'in' }, { id: 'out', type: 'events', dir: 'out' }] },
    { type: 'request', label: 'request', ports: [{ id: 'trigger', type: 'events', dir: 'in' }, { id: 'response', type: 'data', dir: 'out' }] },
    { type: 'cache', label: 'cache', ports: [{ id: 'write', type: 'data', dir: 'in' }, { id: 'read', type: 'data', dir: 'out' }] },
    { type: 'list', label: 'results list', ports: [{ id: 'items', type: 'data', dir: 'in' }] },
    { type: 'db', label: 'database', ports: [{ id: 'query', type: 'data', dir: 'in' }] },
  ],
  requiredNodes: ['input', 'request', 'list'],
  requiredEdges: [['input', 'debounce'], ['debounce', 'request'], ['request', 'list']],
  forbiddenEdges: [['input', 'db']],
  invariants: [{
    id: 'guarded', label: 'responses are ordered or cancelled',
    holds: g => g.nodes.some(n => n.type === 'cache') || g.edges.some(e => e.id.includes('seq')),
  }],
  acceptedVariants: [],
  passThreshold: 0.7,
}

const node = (id: string, type: string) => ({ id, type })
const edge = (id: string, from: string, fromPort: string, to: string, toPort: string) => ({ id, from, fromPort, to, toPort })

const complete: Graph = {
  nodes: [node('a', 'input'), node('b', 'debounce'), node('c', 'request'), node('d', 'list'), node('e', 'cache')],
  edges: [
    edge('e1', 'a', 'keystrokes', 'b', 'in'),
    edge('e2', 'b', 'out', 'c', 'trigger'),
    edge('e3', 'c', 'response', 'd', 'items'),
  ],
}

/** A genuinely different but equally valid shape: sequenced instead of cached. */
const sequenced: Graph = {
  nodes: [node('a', 'input'), node('b', 'debounce'), node('c', 'request'), node('d', 'list')],
  edges: [
    edge('e1', 'a', 'keystrokes', 'b', 'in'),
    edge('e2-seq', 'b', 'out', 'c', 'trigger'),
    edge('e3', 'c', 'response', 'd', 'items'),
  ],
}

const withVariants: CanvasKey = { ...key, acceptedVariants: [complete, sequenced] }

describe('typed ports', () => {
  it('refuses a connection whose port types do not match', () => {
    const input = node('a', 'input'), list = node('d', 'list')
    // events -> data is not a connection anyone should be able to draw.
    expect(canConnect(key, input, 'keystrokes', list, 'items')).toBe(false)
  })
  it('allows a matching out -> in pair', () => {
    expect(canConnect(key, node('a', 'input'), 'keystrokes', node('b', 'debounce'), 'in')).toBe(true)
  })
  it('refuses a backwards connection', () => {
    expect(canConnect(key, node('b', 'debounce'), 'in', node('c', 'request'), 'trigger')).toBe(false)
  })
})

describe('grading weights', () => {
  it('a complete design passes', () => {
    const r = gradeGraph(complete, withVariants)
    expect(r.passed).toBe(true)
    expect(r.score).toBeGreaterThan(0.9)
  })

  it('ZERO required edges scores 0, however many boxes are placed', () => {
    const parts: Graph = { nodes: complete.nodes, edges: [] }
    const r = gradeGraph(parts, withVariants)
    expect(r.score).toBe(0)
    expect(r.zeroedBecause).toMatch(/boxes are not the design/)
    // Not 0.15 for the nodes — participation credit on the design verb is the thing
    // this rule exists to refuse.
    expect(r.nodes.got).toBe(3)
  })

  it('edges dominate: all nodes and one of three edges still fails', () => {
    const oneEdge: Graph = { nodes: complete.nodes, edges: [complete.edges[0]!] }
    const r = gradeGraph(oneEdge, withVariants)
    expect(r.score).toBeLessThan(withVariants.passThreshold)
    expect(r.edges).toMatchObject({ got: 1, want: 3 })
  })

  it('penalises a forbidden connection and names it', () => {
    const bad: Graph = {
      nodes: [...complete.nodes, node('f', 'db')],
      edges: [...complete.edges, edge('x', 'a', 'keystrokes', 'f', 'query')],
    }
    const r = gradeGraph(bad, withVariants)
    expect(r.forbidden).toEqual(['input → db'])
    expect(r.score).toBeLessThan(gradeGraph(complete, withVariants).score)
  })

  it('reports exactly which required edges are missing', () => {
    const partial: Graph = { nodes: complete.nodes, edges: [complete.edges[0]!, complete.edges[1]!] }
    expect(gradeGraph(partial, withVariants).edges.missing).toEqual([['request', 'list']])
  })
})

describe('a key must admit more than one shape', () => {
  it('flags a key with fewer than two accepted variants', () => {
    expect(validateKey({ ...key, acceptedVariants: [complete] })[0]).toMatch(/guess my diagram/)
  })

  it('asserts every declared variant actually clears the threshold', () => {
    expect(validateKey(withVariants)).toEqual([])
  })

  it('catches a variant that does not pass its own key', () => {
    const broken = { ...withVariants, acceptedVariants: [complete, { nodes: complete.nodes, edges: [] }] }
    expect(validateKey(broken).some(p => /scores 0 but passThreshold/.test(p))).toBe(true)
  })

  it('catches a required node missing from the palette', () => {
    expect(validateKey({ ...withVariants, requiredNodes: ['input', 'ghost'] })[0]).toMatch(/not in the palette/)
  })
})

describe('the same grader is used everywhere', () => {
  it('scores an identical graph identically on repeated calls', () => {
    // The drill, the case Canvas tab and the mock all call this; a grader that
    // disagreed with itself between surfaces would be undetectable in the UI.
    const a = gradeGraph(complete, withVariants)
    const b = gradeGraph(structuredClone(complete), withVariants)
    expect(a).toEqual(b)
  })
})
