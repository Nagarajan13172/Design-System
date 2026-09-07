import { useState } from 'react'
import type { LaneTimelineState, StateMatrixState, Annotation } from '@content/types'
import { LaneTimeline } from '../primitives/LaneTimeline'
import { StateMatrix } from '../primitives/StateMatrix'
import { DevShell } from './DevShell'

/**
 * DEV ONLY. Every primitive, every variant, over synthetic state.
 *
 * Doubles as the accessibility surface: this is the page `pnpm test:a11y` runs axe
 * against, so a primitive with a contrast or labelling defect fails once here
 * rather than in each of the modules that use it. It also shows the GATED state,
 * which is the property most likely to regress.
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

export default function DevPrimitives() {
  const [gated, setGated] = useState(false)
  return (
    <DevShell title="primitives" aside={
      <label className="flex items-center gap-2 mb-5" style={{ color: 'var(--text-dim)' }}>
        <input type="checkbox" checked={gated} onChange={e => setGated(e.target.checked)} />
        show the gated state (no prediction committed — scaffold only, no data)
      </label>
    }>
      <Case name="LaneTimeline" clients={82}>
        <LaneTimeline state={gated ? null : laneState} annotations={gated ? [] : laneAnnotations}
                      ghost={{ ...laneState, spans: laneState.spans.map(s => ({ ...s, t1: s.t1 - 120 })) }} />
      </Case>
      <Case name="StateMatrix" clients={31}>
        <StateMatrix state={gated ? null : matrixState} annotations={gated ? [] : [
          { id: 'm1', at: { x: 0, y: 0 }, text: 'sequencing fixes what is rendered; cancellation fixes what is spent', tone: 'neutral' },
        ]} />
      </Case>
      <Case name="NodeGraph · Plot2D · LiveSurface · CodeStage" clients={56}>
        <div className="rounded border border-dashed p-6 text-center"
             style={{ borderColor: 'var(--border-strong)', color: 'var(--text-faint)' }}>
          scheduled for M4 — each needs ≥2 real module clients before it is declared validated
        </div>
      </Case>
    </DevShell>
  )
}

function Case({ name, clients, children }: { name: string; clients: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="flex items-baseline gap-2 mb-2">
        <span className="font-mono" style={{ color: 'var(--text)' }}>{name}</span>
        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{clients} modules</span>
      </h2>
      <div className="rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--raised)' }}>{children}</div>
    </section>
  )
}
