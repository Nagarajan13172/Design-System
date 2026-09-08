import { useId } from 'react'
import type { NodeGraphState } from '@content/types'
import type { PrimitiveProps } from './types'

/**
 * NodeGraph — 35 modules. Dependency graphs, blast radius, trust boundaries,
 * import trees, stacking contexts, accessibility trees.
 *
 * Hand-rolled SVG over AUTHORED coordinates (ADR-6: no graph library, no runtime
 * layout). The propagation wave is ONE animated channel — an expanding radius from
 * a source node — because the cognitive-load rule allows two and the node states
 * are the other one.
 */
const NODE_FILL = {
  idle: 'var(--surface)', active: 'var(--accent-bg)', visited: 'var(--surface)',
  blocked: 'color-mix(in oklch, var(--d-error) 14%, transparent)',
  flagged: 'color-mix(in oklch, var(--d-blocked) 16%, transparent)',
  dim: 'transparent',
} as const

const NODE_STROKE = {
  idle: 'var(--border-strong)', active: 'var(--accent)', visited: 'var(--d-work)',
  blocked: 'var(--d-error)', flagged: 'var(--d-blocked)', dim: 'var(--border)',
} as const

const PAD = 16
const DEFAULT_W = 108
const DEFAULT_H = 34

export function NodeGraph({
  state, annotations, ghost, showGhost = true, composite = false, labelledBy,
}: PrimitiveProps<NodeGraphState>) {
  const uid = useId().replace(/:/g, '')
  // Nodes come from the scaffold even when gated, so the learner can see the shape
  // of what they are predicting about — with no states, no wave, no answer.
  const nodes = state?.nodes ?? ghost?.nodes ?? []
  const edges = state?.edges ?? ghost?.edges ?? []

  // Not memoized: a max over a few dozen authored coordinates is cheaper than the
  // comparison a memo would need, and the dep would change identity every render.
  const box = nodes.length
    ? {
        w: Math.max(...nodes.map(n => n.x + (n.w ?? DEFAULT_W))) + PAD,
        h: Math.max(...nodes.map(n => n.y + (n.h ?? DEFAULT_H))) + PAD,
      }
    : { w: 640, h: 220 }

  const byId = new Map(nodes.map(n => [n.id, n]))
  const centre = (id: string) => {
    const n = byId.get(id)
    return n ? { x: n.x + (n.w ?? DEFAULT_W) / 2, y: n.y + (n.h ?? DEFAULT_H) / 2 } : { x: 0, y: 0 }
  }

  const waveSource = state?.wave ? centre(state.wave.from) : null
  const onActivePath = (edgeId: string) => {
    const path = state?.activePath
    if (!path) return false
    const e = edges.find(x => x.id === edgeId)
    if (!e) return false
    const i = path.indexOf(e.from)
    return i >= 0 && path[i + 1] === e.to
  }

  return (
    <svg viewBox={`0 0 ${box.w} ${box.h}`} className="w-full h-auto" role="img" aria-labelledby={labelledBy}
         aria-label={labelledBy ? undefined : 'graph of related nodes'}
         style={{ fontFamily: 'var(--font-sans)' }}>
      <defs>
        <marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--text-faint)" />
        </marker>
        <marker id={`${uid}-arrow-active`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
        </marker>
      </defs>

      {/* The ghost baseline: the same graph in its prior shape, behind. */}
      {showGhost && ghost?.edges.map(e => {
        const a = ghost.nodes.find(n => n.id === e.from), b = ghost.nodes.find(n => n.id === e.to)
        if (!a || !b) return null
        return <line key={`g-${e.id}`} x1={a.x + DEFAULT_W / 2} y1={a.y + DEFAULT_H / 2}
                     x2={b.x + DEFAULT_W / 2} y2={b.y + DEFAULT_H / 2}
                     stroke="var(--d-ghost)" strokeWidth="1" strokeDasharray="3 3" />
      })}

      {/* Edges first, so nodes sit on top of them. */}
      {state?.edges.map(e => {
        const a = centre(e.from), b = centre(e.to)
        const st = state.edgeState?.[e.id] ?? 'idle'
        const active = st === 'active' || onActivePath(e.id)
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        return (
          <g key={e.id} opacity={st === 'dim' ? 0.25 : 1}>
            <path d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`} fill="none"
                  stroke={active ? 'var(--accent)' : st === 'blocked' ? 'var(--d-error)' : 'var(--border-strong)'}
                  strokeWidth={active ? 1.75 : 1}
                  strokeDasharray={e.kind === 'retain' ? '4 3' : undefined}
                  markerEnd={`url(#${uid}-${active ? 'arrow-active' : 'arrow'})`}
                  style={{ transition: 'stroke 160ms cubic-bezier(.2,0,0,1)' }} />
            {e.label && <text x={mx} y={my - 4} fontSize="9" fill="var(--text-faint)" textAnchor="middle">{e.label}</text>}
          </g>
        )
      })}

      {/* The propagation wave — the single animated channel. */}
      {waveSource && state?.wave && (
        <circle cx={waveSource.x} cy={waveSource.y} r={state.wave.radius}
                fill="none" stroke="var(--accent)" strokeWidth="1" opacity={0.5}
                style={{ transition: 'r 200ms cubic-bezier(.2,0,0,1)' }} />
      )}

      {nodes.map(n => {
        const st = state?.nodeState[n.id] ?? 'idle'
        const w = n.w ?? DEFAULT_W, h = n.h ?? DEFAULT_H
        const gated = !state
        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={w} height={h}
                  rx={n.shape === 'round' ? h / 2 : 3}
                  fill={gated ? 'transparent' : NODE_FILL[st]}
                  stroke={gated ? 'var(--border)' : NODE_STROKE[st]}
                  strokeWidth={st === 'active' ? 1.75 : 1}
                  strokeDasharray={gated ? '3 2' : undefined}
                  style={{ transition: 'fill 160ms cubic-bezier(.2,0,0,1), stroke 160ms' }} />
            <text x={n.x + w / 2} y={n.y + h / 2 + 3.5} fontSize="10.5" textAnchor="middle"
                  fill={gated ? 'var(--text-faint)' : st === 'dim' ? 'var(--text-faint)' : 'var(--text)'}>
              {n.label}
            </text>
            {n.badge && !gated && (
              <>
                <circle cx={n.x + w - 4} cy={n.y + 4} r="7" fill="var(--accent)" />
                <text x={n.x + w - 4} y={n.y + 7.5} fontSize="8.5" textAnchor="middle" fill="var(--bg)">{n.badge}</text>
              </>
            )}
          </g>
        )
      })}

      {/* Annotations anchored INSIDE the diagram, never in a side panel. */}
      {state && annotations.map((a, i) => {
        const at = a.at
        const p = 'laneId' in at ? centre(at.laneId) : { x: at.x, y: at.y }
        const flip = p.x > box.w * 0.6
        const tone = a.tone === 'bad' ? 'var(--d-error)' : a.tone === 'good' ? 'var(--d-work)' : 'var(--text-dim)'
        return (
          <g key={a.id}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={tone} />
            <line x1={p.x} y1={p.y} x2={flip ? p.x - 14 : p.x + 14} y2={p.y - 14} stroke={tone} strokeWidth="0.75" />
            <text x={flip ? p.x - 16 : p.x + 16} y={p.y - 15} fontSize="9.5" fill={tone} textAnchor={flip ? 'end' : 'start'}>
              {composite ? `${i + 1}. ${a.text}` : a.text}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
