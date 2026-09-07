import { useId, useMemo } from 'react'
import type { LaneTimelineState, SpanKind } from '@content/types'
import type { PrimitiveProps } from './types'

/**
 * LaneTimeline — the workhorse. 82 of the 169 modules are a timeline of some
 * shape: request waterfalls, handshake ladders, main-thread tapes, swimlanes.
 *
 * Hand-rolled SVG. Annotations are anchored INSIDE the plot area, never in a side
 * panel — a side panel is a split-attention violation, which is the specific way
 * a beautiful diagram teaches nothing.
 */
const KIND_FILL: Record<SpanKind, string> = {
  network: 'var(--d-network)', work: 'var(--d-work)', blocked: 'var(--d-blocked)',
  paint: 'var(--d-paint)', idle: 'var(--d-idle)', error: 'var(--d-error)',
  stale: 'var(--d-stale)', wait: 'var(--d-idle)',
}
/** Every kind is distinguishable without colour: hatched kinds carry a pattern. */
const KIND_HATCH: Partial<Record<SpanKind, string>> = { stale: 'hatch-stale', blocked: 'hatch-blocked' }

const PAD = { l: 132, r: 16, t: 14, b: 30 }
const ROW = 30
const W = 760

export function LaneTimeline({
  state, annotations, ghost, showGhost = true, composite = false, labelledBy,
}: PrimitiveProps<LaneTimelineState>) {
  const uid = useId().replace(/:/g, '')
  // Lanes come from the scaffold even when gated, so the figure has real shape
  // before any data exists — the learner can see WHAT they are predicting about.
  const lanes = state?.lanes ?? ghost?.lanes ?? []
  const h = PAD.t + lanes.length * ROW + PAD.b

  const tMax = useMemo(() => {
    const ts = [
      ...(state?.spans ?? []).map(s => s.t1),
      ...(ghost?.spans ?? []).map(s => s.t1),
      ...(state?.markers ?? []).map(m => m.t),
    ]
    return Math.max(1000, ...ts) * 1.04
  }, [state, ghost])

  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r)
  const y = (laneId: string) => {
    const i = lanes.findIndex(l => l.id === laneId)
    return PAD.t + (i < 0 ? 0 : i) * ROW
  }
  const ticks = useMemo(() => {
    const step = Math.pow(10, Math.floor(Math.log10(tMax / 4)))
    const s = [500, 250, 200, 100].map(m => step * (m / 100)).find(v => tMax / v <= 8) ?? step
    return Array.from({ length: Math.floor(tMax / s) + 1 }, (_, i) => i * s)
  }, [tMax])

  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full h-auto" role="img" aria-labelledby={labelledBy}
         style={{ fontFamily: 'var(--font-mono)' }}>
      <defs>
        <pattern id={`${uid}-hatch-stale`} width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="var(--d-stale)" /><line x1="0" y1="0" x2="0" y2="5" stroke="var(--bg)" strokeWidth="2" />
        </pattern>
        <pattern id={`${uid}-hatch-blocked`} width="4" height="4" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--d-blocked)" /><line x1="0" y1="0" x2="0" y2="4" stroke="var(--bg)" strokeWidth="1.5" />
        </pattern>
        <marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--text-faint)" />
        </marker>
      </defs>

      {/* time axis */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={x(t)} y1={PAD.t} x2={x(t)} y2={h - PAD.b} stroke="var(--border)" strokeWidth="1" />
          <text x={x(t)} y={h - PAD.b + 15} fontSize="9" fill="var(--text-faint)" textAnchor="middle">{t}ms</text>
        </g>
      ))}

      {/* lanes: the scaffold, present whether or not data is */}
      {lanes.map(l => (
        <g key={l.id}>
          <text x={PAD.l - 10} y={y(l.id) + ROW / 2 + 3} fontSize="10" fill="var(--text-dim)" textAnchor="end">{l.label}</text>
          <line x1={PAD.l} y1={y(l.id) + ROW - 1} x2={W - PAD.r} y2={y(l.id) + ROW - 1} stroke="var(--border)" strokeWidth="0.5" />
        </g>
      ))}

      {/* ghost baseline, underneath and low-contrast */}
      {showGhost && ghost?.spans.map(s => (
        <rect key={`g-${s.id}`} x={x(s.t0)} y={y(s.laneId) + 8} width={Math.max(2, x(s.t1) - x(s.t0))} height={ROW - 17}
              fill="none" stroke="var(--d-ghost)" strokeWidth="1" strokeDasharray="3 2" rx="2" />
      ))}

      {/* THE DATA. Absent entirely until the prediction gate opens. */}
      {state?.spans.map(s => (
        <g key={s.id}>
          {/* data-span marks REAL DATA, so "the gate rendered nothing" is assertable
              without counting <defs> pattern rects. M3's Playwright check reads it too. */}
          <rect data-span={s.kind} x={x(s.t0)} y={y(s.laneId) + 7} width={Math.max(2, x(s.t1) - x(s.t0))} height={ROW - 15}
                fill={KIND_HATCH[s.kind] ? `url(#${uid}-${KIND_HATCH[s.kind]})` : KIND_FILL[s.kind]}
                rx="2" opacity="0.92" />
          {s.label && x(s.t1) - x(s.t0) > 34 && (
            <text x={x(s.t0) + 5} y={y(s.laneId) + ROW / 2 + 3} fontSize="9" fill="var(--bg)">{s.label}</text>
          )}
        </g>
      ))}

      {state?.messages?.map(m => (
        <path key={m.id} d={`M${x(m.t)},${y(m.fromLane) + ROW - 6} L${x(m.t)},${y(m.toLane) + 6}`}
              stroke="var(--text-faint)" strokeWidth="1" markerEnd={`url(#${uid}-arrow)`} />
      ))}

      {state?.markers?.map(m => (
        <line key={m.id} x1={x(m.t)} y1={PAD.t} x2={x(m.t)} y2={h - PAD.b}
              stroke={m.tone === 'bad' ? 'var(--d-error)' : 'var(--accent)'} strokeWidth="1" strokeDasharray="2 2" />
      ))}

      {/* scrub head */}
      {state?.head != null && (
        <line x1={x(state.head)} y1={PAD.t - 4} x2={x(state.head)} y2={h - PAD.b} stroke="var(--accent)" strokeWidth="1.5" />
      )}

      {/* annotations, anchored INSIDE the diagram */}
      {state && annotations.map((a, i) => {
        const at = a.at
        const ax = 'laneId' in at ? x(at.t) : at.x
        const ay = 'laneId' in at ? y(at.laneId) + ROW / 2 : at.y
        const flip = ax > W * 0.62
        const tone = a.tone === 'bad' ? 'var(--d-error)' : a.tone === 'good' ? 'var(--d-work)' : 'var(--text-dim)'
        return (
          <g key={a.id}>
            <circle cx={ax} cy={ay} r="2.5" fill={tone} />
            <line x1={ax} y1={ay} x2={flip ? ax - 12 : ax + 12} y2={ay - 11} stroke={tone} strokeWidth="0.75" />
            <text x={flip ? ax - 14 : ax + 14} y={ay - 12} fontSize="9.5" fill={tone} textAnchor={flip ? 'end' : 'start'}>
              {composite ? `${i + 1}. ${a.text}` : a.text}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
