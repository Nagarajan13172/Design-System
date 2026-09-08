/**
 * cs-autocomplete — THE SIM REUSE PROOF.
 *
 * This case study does not have its own race simulator. It imports `state-races`'
 * sim VERBATIM and re-parameterises it, which is the evidence the whole content
 * pipeline was built for: a case study should cash in the knowledge modules it
 * depends on rather than re-deriving them.
 *
 * If reuse only ever worked in the plan, every case study would be a snowflake and
 * twenty of them would cost twenty times one. Measured: this file is ~70 lines
 * against state-races' ~180, and the mechanism is identical.
 */
import { TimelineBuilder, note } from '../../../src/sim'
import { measure as raceMeasure, DEFAULTS as RACE_DEFAULTS, type Params as RaceParams } from '../../state/state-races/sim'
import type { Rng, Timeline, LaneTimelineState } from '../../types'
import type { CanvasKey } from '../../../src/domain/grading/graph'

/** The case takes the module's parameters wholesale — that is the reuse. */
export type Params = RaceParams

/** The case's own numbers, fed through the module's simulator unchanged. */
export const DEFAULTS: Params = { ...RACE_DEFAULTS, debounceMs: 150, medianMs: 260, p95Ms: 600, sessions: 600 }

/** Re-exported so the test can assert the reuse is real rather than a copy. */
export const measure = raceMeasure

const LANES: LaneTimelineState['lanes'] = [
  { id: 'user', label: 'typing', role: 'actor' },
  { id: 'req', label: 'in flight', role: 'resource' },
  { id: 'list', label: 'visible list', role: 'thread' },
]

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<LaneTimelineState> {
  const p = { ...DEFAULTS, ...params }
  const at150 = raceMeasure(p)
  const at400 = raceMeasure({ ...p, debounceMs: 400 })
  // The same 400ms debounce on a slower network — the number that matters.
  const at400Slow = raceMeasure({ ...p, debounceMs: 400, p95Ms: 1500 })
  const sequenced = raceMeasure({ ...p, sequencing: true })

  const spans = (kind: 'network' | 'stale') => ([
    { id: 's1', laneId: 'req', t0: 150, t1: 700, label: 'reac', kind: 'network' as const },
    { id: 's2', laneId: 'req', t0: 420, t1: 640, label: 'react', kind: 'network' as const },
    { id: 's3', laneId: 'list', t0: 640, t1: 700, label: 'react', kind: 'work' as const },
    { id: 's4', laneId: 'list', t0: 700, t1: 900, label: 'reac (stale)', kind },
  ])

  const b = new TimelineBuilder<LaneTimelineState>()

  b.stage('debounce', 'The debounce does its job')
  b.frame({
    narration: `A 150ms trailing debounce cuts request volume to ${at150.avgRequestsPerSession.toFixed(1)} per query. That is a cost control, and it works.`,
    channels: ['req'], explains: 'cs-autocomplete-c1',
    annotations: [note('a1', 'req', 150, 'fires after the pause')],
    state: { lanes: LANES, spans: spans('network').slice(0, 2), head: 420 },
  })

  b.stage('stale', 'And the list still goes wrong')
  b.frame({
    narration: `${Math.round(at150.staleRate * 100)}% of typed queries end with the list showing results for a query no longer in the box. Nothing errored.`,
    channels: ['req', 'list'], explains: 'cs-autocomplete-c2',
    annotations: [note('a2', 'list', 700, 'shows "reac" while the box reads "react"', 'bad')],
    state: { lanes: LANES, spans: spans('stale'), head: 900 },
  })

  b.stage('bigger', 'Raising the debounce only looks like a fix')
  b.frame({
    narration: `At 400ms the rate falls to ${at400.staleRate.toFixed(3).replace(/0+$/, '')}% on this network — near enough to zero that it ships. Put the same build on a p95 of 1500ms and it is back at ${Math.round(at400Slow.staleRate * 100)}%, because the window is a ratio to a latency tail you do not control.`,
    channels: ['list'], explains: 'cs-autocomplete-c3',
    annotations: [
      note('a3', 'list', 700, `${(at400.staleRate * 100).toFixed(1)}% here`, 'good'),
      note('a3b', 'list', 860, `${Math.round(at400Slow.staleRate * 100)}% on a slow network`, 'bad'),
    ],
    state: { lanes: LANES, spans: spans('stale'), head: 900 },
  })

  b.stage('guard', 'A sequence guard does')
  b.frame({
    narration: `Dropping any response that is not the newest takes it to ${Math.round(sequenced.staleRate * 100)}%, and cancels nothing.`,
    channels: ['list'], explains: 'cs-autocomplete-c4',
    annotations: [note('a4', 'list', 640, 'newest query wins, always', 'good')],
    state: { lanes: LANES, spans: spans('network'), head: 900 },
  })

  return b.build(
    {
      label: 'with a 400ms debounce',
      frames: [{
        t: 0, narration: `A longer debounce: ${(at400.staleRate * 100).toFixed(1)}% stale here, ${Math.round(at400Slow.staleRate * 100)}% on a slow network, and a box that feels sluggish either way.`,
        channels: [], explains: 'cs-autocomplete-c3',
        annotations: [note('g1', 'req', 400, 'every request delayed 400ms')],
        state: { lanes: LANES, spans: spans('stale') },
      }],
    },
    {
      staleAt150Pct: Math.round(at150.staleRate * 100),
      staleAt400Pct: Number((at400.staleRate * 100).toFixed(1)),
      staleAt400SlowNetworkPct: Math.round(at400Slow.staleRate * 100),
      staleSequencedPct: Math.round(sequenced.staleRate * 100),
      requestsPerQuery: Number(at150.avgRequestsPerSession.toFixed(1)),
    },
  )
}

/**
 * The Canvas key for this case. Two accepted variants — sequenced and cancelled —
 * because a key that admits exactly one shape teaches "guess my diagram".
 */
export const canvasKey: CanvasKey = {
  palette: [
    { type: 'input', label: 'search input', max: 1, ports: [{ id: 'keys', type: 'events', dir: 'out' }] },
    { type: 'debounce', label: 'debounce', max: 1, ports: [{ id: 'in', type: 'events', dir: 'in' }, { id: 'out', type: 'events', dir: 'out' }] },
    { type: 'request', label: 'request', ports: [{ id: 'trigger', type: 'events', dir: 'in' }, { id: 'response', type: 'data', dir: 'out' }] },
    { type: 'guard', label: 'sequence guard', ports: [{ id: 'in', type: 'data', dir: 'in' }, { id: 'out', type: 'data', dir: 'out' }] },
    { type: 'abort', label: 'AbortController', ports: [{ id: 'in', type: 'data', dir: 'in' }, { id: 'out', type: 'data', dir: 'out' }] },
    { type: 'list', label: 'results list', max: 1, ports: [{ id: 'items', type: 'data', dir: 'in' }] },
    { type: 'db', label: 'database', ports: [{ id: 'q', type: 'data', dir: 'in' }] },
  ],
  requiredNodes: ['input', 'debounce', 'request', 'list'],
  requiredEdges: [['input', 'debounce'], ['debounce', 'request']],
  forbiddenEdges: [['input', 'db'], ['request', 'list']],
  invariants: [{
    id: 'guarded',
    label: 'nothing stands between the response and the list',
    // CRITICAL: the guard is the architecture here. A design without one is not
    // 90% right, it is the bug the case study is about.
    critical: true,
    holds: g => g.nodes.some(n => n.type === 'guard' || n.type === 'abort')
      && g.edges.some(e => {
        const to = g.nodes.find(n => n.id === e.to)
        return to?.type === 'list'
          && ['guard', 'abort'].includes(g.nodes.find(n => n.id === e.from)?.type ?? '')
      }),
  }],
  acceptedVariants: [
    {
      nodes: [
        { id: 'i', type: 'input' }, { id: 'd', type: 'debounce' }, { id: 'r', type: 'request' },
        { id: 'g', type: 'guard' }, { id: 'l', type: 'list' },
      ],
      edges: [
        { id: 'e1', from: 'i', fromPort: 'keys', to: 'd', toPort: 'in' },
        { id: 'e2', from: 'd', fromPort: 'out', to: 'r', toPort: 'trigger' },
        { id: 'e3', from: 'r', fromPort: 'response', to: 'g', toPort: 'in' },
        { id: 'e4', from: 'g', fromPort: 'out', to: 'l', toPort: 'items' },
      ],
    },
    {
      nodes: [
        { id: 'i', type: 'input' }, { id: 'd', type: 'debounce' }, { id: 'r', type: 'request' },
        { id: 'a', type: 'abort' }, { id: 'l', type: 'list' },
      ],
      edges: [
        { id: 'e1', from: 'i', fromPort: 'keys', to: 'd', toPort: 'in' },
        { id: 'e2', from: 'd', fromPort: 'out', to: 'r', toPort: 'trigger' },
        { id: 'e3', from: 'r', fromPort: 'response', to: 'a', toPort: 'in' },
        { id: 'e4', from: 'a', fromPort: 'out', to: 'l', toPort: 'items' },
      ],
    },
  ],
  passThreshold: 0.7,
}
