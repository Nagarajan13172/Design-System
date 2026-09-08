import { useState } from 'react'
import type {
  LaneTimelineState, StateMatrixState, NodeGraphState, Plot2DState,
  CodeStageState, LiveSurfaceState, Annotation, Primitive,
} from '@content/types'
import { MODULES } from 'virtual:manifest-lite'
import { LaneTimeline } from '../primitives/LaneTimeline'
import { StateMatrix } from '../primitives/StateMatrix'
import { NodeGraph } from '../primitives/NodeGraph'
import { Plot2D } from '../primitives/Plot2D'
import { CodeStage } from '../primitives/CodeStage'
import { LiveSurface } from '../primitives/LiveSurface'
import { VALIDATION_THRESHOLD } from '../primitives/Figure'
import { DevShell } from './DevShell'

/**
 * DEV ONLY. Every primitive, every variant, over synthetic state.
 *
 * Doubles as the accessibility surface — this is the page `pnpm e2e` runs axe
 * against, so a primitive with a contrast or labelling defect fails once here rather
 * than in each of the modules that use it. It also shows the GATED state, which is
 * the property most likely to regress.
 *
 * The validation counts are COMPUTED from the manifest, not asserted in prose: a
 * primitive with one client cannot be known to generalise, and writing "validated"
 * in a comment would not make it so.
 */
const lanes: LaneTimelineState['lanes'] = [
  { id: 'user', label: 'keystrokes', role: 'actor' },
  { id: 'r0', label: 'request 1', role: 'resource' },
  { id: 'r1', label: 'request 2', role: 'resource' },
  { id: 'screen', label: 'what the user sees', role: 'thread' },
]
const laneState: LaneTimelineState = {
  lanes,
  spans: [
    { id: 's0', laneId: 'r0', t0: 300, t1: 1100, label: 'slow', kind: 'network' },
    { id: 's1', laneId: 'r1', t0: 640, t1: 780, label: 'fast', kind: 'network' },
    { id: 's2', laneId: 'screen', t0: 780, t1: 1100, label: 'correct', kind: 'work' },
    { id: 's3', laneId: 'screen', t0: 1100, t1: 1500, label: 'STALE', kind: 'stale' },
  ],
  markers: [{ id: 'm', t: 1100, label: 'overwrite', tone: 'bad' }],
  head: 1100,
}
const laneAnnotations: Annotation[] = [
  { id: 'a', at: { laneId: 'r0', t: 1100 }, text: 'arrives last', tone: 'bad' },
  { id: 'b', at: { laneId: 'screen', t: 780 }, text: 'briefly correct', tone: 'good' },
]
const matrixState: StateMatrixState = {
  rows: [{ id: 'debounce', label: 'debounce only' }, { id: 'cancel', label: 'AbortController' }, { id: 'seq', label: 'sequence number' }],
  cols: [{ id: 'render', label: 'correct render' }, { id: 'bytes', label: 'saves bytes' }, { id: 'effects', label: 'undoes effects' }],
  cells: {
    'debounce:render': { state: 'partial', value: 'mostly' }, 'debounce:bytes': { state: 'pass' }, 'debounce:effects': { state: 'fail' },
    'cancel:render': { state: 'pass' }, 'cancel:bytes': { state: 'pass' }, 'cancel:effects': { state: 'fail', note: 'the request may already have landed' },
    'seq:render': { state: 'pass' }, 'seq:bytes': { state: 'fail' }, 'seq:effects': { state: 'fail' },
  },
  cursor: { row: 'seq', col: 'render' },
  meter: { label: 'stale renders', value: 0, max: 25, unit: '%' },
}
const graphState: NodeGraphState = {
  nodes: [
    { id: 'root', label: 'html', x: 20, y: 16, w: 96 },
    { id: 'header', label: 'header z:10', x: 150, y: 16, w: 120 },
    { id: 'card', label: 'card · transform', x: 150, y: 84, w: 132 },
    { id: 'modal', label: 'modal z:9999', x: 320, y: 84, w: 130 },
  ],
  edges: [
    { id: 'e1', from: 'root', to: 'header', kind: 'contains' },
    { id: 'e2', from: 'root', to: 'card', kind: 'contains' },
    { id: 'e3', from: 'card', to: 'modal', kind: 'contains' },
  ],
  nodeState: { root: 'idle', header: 'active', card: 'blocked', modal: 'blocked' },
  wave: { from: 'card', radius: 70 },
  activePath: ['card', 'modal'],
}
const plotState: Plot2DState = {
  xAxis: { label: 'LCP', unit: 'ms', min: 0, max: 6000 },
  yAxis: { label: 'sessions' },
  series: [{
    id: 'field', label: 'field', kind: 'hist', tone: 'accent',
    points: Array.from({ length: 20 }, (_, i) => ({ x: i * 300 + 150, y: Math.round(200 * Math.exp(-((i - 5) ** 2) / 22)) })),
  }],
  thresholds: [
    { id: 'good', axis: 'x', value: 2500, label: 'good ≤ 2500ms', tone: 'good' },
    { id: 'p75', axis: 'x', value: 3400, label: 'p75', tone: 'bad' },
  ],
}
const codeState: CodeStageState = {
  palette: { c0: { light: '#D73A49', dark: '#F97583' }, c1: { light: '#24292E', dark: '#E1E4E8' }, c2: { light: '#005CC5', dark: '#79B8FF' } },
  blocks: [{
    id: 'demo', label: 'sequence guard',
    lines: [
      [{ text: 'const', cls: 'c0' }, { text: ' ', cls: 'c1' }, { text: 'seq', cls: 'c2' }, { text: ' = ++', cls: 'c1' }, { text: 'latest', cls: 'c2' }],
      [{ text: 'if', cls: 'c0' }, { text: ' (', cls: 'c1' }, { text: 'seq', cls: 'c2' }, { text: ' !== ', cls: 'c1' }, { text: 'latest', cls: 'c2' }, { text: ') ', cls: 'c1' }, { text: 'return', cls: 'c0' }],
    ],
  }],
  highlight: [{ blockId: 'demo', lines: [1], tone: 'good' }],
}
const surfaceState: LiveSurfaceState = {
  props: {},
  overlays: [
    { id: 'o1', kind: 'label', selector: 'input', text: 'unnamed', tone: 'bad' },
    { id: 'o2', kind: 'order', selector: 'button', order: 2, tone: 'neutral' },
  ],
  counters: [{ label: 'field name', value: '(none)' }, { label: 'computed from', value: 'placeholder' }],
}

export default function DevPrimitives() {
  const [gated, setGated] = useState(false)
  const built = MODULES.filter(m => m.status !== 'planned')
  const clientsOf = (p: Primitive) => built.filter(m => m.primitive === p).map(m => m.id)
  const demand = (p: Primitive) => MODULES.filter(m => m.primitive === p).length

  return (
    <DevShell title="primitives" aside={
      <label className="flex items-center gap-2 mb-5" style={{ color: 'var(--text-dim)' }}>
        <input type="checkbox" checked={gated} onChange={e => setGated(e.target.checked)} />
        show the gated state (no prediction committed — scaffold only, no data)
      </label>
    }>
      <Case name="LaneTimeline" primitive="LaneTimeline" clients={clientsOf('LaneTimeline')} demand={demand('LaneTimeline')}>
        <LaneTimeline state={gated ? null : laneState} annotations={gated ? [] : laneAnnotations}
                      ghost={{ ...laneState, spans: laneState.spans.map(s => ({ ...s, t1: s.t1 - 120 })) }} />
      </Case>

      <Case name="StateMatrix" primitive="StateMatrix" clients={clientsOf('StateMatrix')} demand={demand('StateMatrix')}>
        <StateMatrix state={gated ? null : matrixState} annotations={gated ? [] : [
          { id: 'm1', at: { x: 0, y: 0 }, text: 'sequencing fixes what is rendered; cancellation fixes what is spent' },
        ]} />
      </Case>

      <Case name="NodeGraph" primitive="NodeGraph" clients={clientsOf('NodeGraph')} demand={demand('NodeGraph')}>
        <NodeGraph state={gated ? null : graphState} annotations={gated ? [] : [
          { id: 'n1', at: { laneId: 'modal', t: 0 }, text: 'trapped — 9999 never meets 10', tone: 'bad' },
        ]} />
      </Case>

      <Case name="Plot2D" primitive="Plot2D" clients={clientsOf('Plot2D')} demand={demand('Plot2D')}
            note="also backs both instruments on /progress">
        <Plot2D state={gated ? null : plotState} annotations={[]} />
      </Case>

      <Case name="CodeStage" primitive="CodeStage" clients={clientsOf('CodeStage')} demand={demand('CodeStage')}
            note="used by code-cloze and code-diff drills rather than as a module figure">
        <CodeStage state={gated ? null : codeState} annotations={[]} />
      </Case>

      <Case name="LiveSurface" primitive="LiveSurface" clients={clientsOf('LiveSurface')} demand={demand('LiveSurface')}
            note="the documented exception: real DOM, anchors resolved post-layout">
        <LiveSurface state={gated ? null : surfaceState} annotations={[]}
          render={() => (
            // data-intentional-a11y-defect: this markup IS the lesson — an icon
            // button whose only text is aria-hidden. The axe gate excludes it by
            // this attribute so a real regression elsewhere still fails the build.
            <form data-intentional-a11y-defect className="flex items-end gap-2" onSubmit={e => e.preventDefault()}>
              <input placeholder="Search…" className="px-2 py-1.5 rounded border"
                     style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)', width: 200 }} />
              <button type="submit" className="px-3 py-1.5 rounded border"
                      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                <span aria-hidden>Submit</span>
              </button>
            </form>
          )} />
      </Case>
    </DevShell>
  )
}

function Case({ name, clients, demand, note, children }: {
  name: string; primitive: Primitive; clients: string[]; demand: number; note?: string; children: React.ReactNode
}) {
  const validated = clients.length >= VALIDATION_THRESHOLD
  return (
    <section className="mb-9">
      <h2 className="flex items-baseline gap-2 mb-1 flex-wrap">
        <span className="font-mono" style={{ color: 'var(--text)' }}>{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider"
              style={{
                background: validated ? 'color-mix(in oklch, var(--d-work) 16%, transparent)' : 'var(--surface)',
                color: validated ? 'var(--d-work-text)' : 'var(--text-faint)',
                border: '1px solid ' + (validated ? 'var(--d-work)' : 'var(--border-strong)'),
              }}>
          {validated ? 'validated' : 'provisional'}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {clients.length} built client{clients.length === 1 ? '' : 's'} · {demand} modules specified
        </span>
      </h2>
      <p className="mb-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        {clients.length ? clients.join(', ') : 'no module figures yet'}{note ? ` · ${note}` : ''}
        {!validated && ` · needs ${VALIDATION_THRESHOLD} clients before the abstraction can be called validated`}
      </p>
      <div className="rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--raised)' }}>{children}</div>
    </section>
  )
}
