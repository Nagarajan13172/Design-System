import { useState } from 'react'
import { LAYOUT } from 'virtual:roadmap-graph'
import { MODULES } from 'virtual:manifest-lite'
import { useApp } from '@/store'

/**
 * The canvas. ADR-6: a hand-rolled <svg> over BUILD-TIME-COMMITTED coordinates —
 * `<rect>` nodes, `<path>` edges, pan and zoom by a single viewBox transform.
 * @xyflow/react was 45-50kb gz to do exactly this over coordinates we already have.
 *
 * It is `aria-hidden` and untabbable THROUGHOUT, on purpose: the semantic list
 * underneath is the interface, and a second, worse copy of it in the tab order would
 * make the page harder to use, not easier. One selection in the store drives both.
 */
export default function MapLayer() {
  const { selectedModule, select } = useApp()
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const status = new Map(MODULES.map(m => [m.id, m.status]))

  const vb = `${view.x} ${view.y} ${LAYOUT.width / view.k} ${LAYOUT.height / view.k}`

  return (
    <div className="map-layer fixed inset-x-0 bottom-0 border-t" aria-hidden
         style={{ top: 44, background: 'var(--bg)', zIndex: 5 }}>
      <div className="absolute right-3 top-3 flex gap-1 z-10">
        {([['−', 1 / 1.25], ['+', 1.25]] as const).map(([label, f]) => (
          <button key={label} tabIndex={-1} onClick={() => setView(v => ({ ...v, k: Math.min(3, Math.max(0.4, v.k * f)) }))}
                  className="px-2 py-1 rounded border font-mono"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-dim)' }}>
            {label}
          </button>
        ))}
      </div>

      <svg viewBox={vb} className="w-full h-full" style={{ cursor: drag ? 'grabbing' : 'grab' }}
           onPointerDown={e => setDrag({ x: e.clientX, y: e.clientY })}
           onPointerUp={() => setDrag(null)}
           onPointerLeave={() => setDrag(null)}
           onPointerMove={e => {
             if (!drag) return
             setView(v => ({ ...v, x: v.x - (e.clientX - drag.x) / v.k, y: v.y - (e.clientY - drag.y) / v.k }))
             setDrag({ x: e.clientX, y: e.clientY })
           }}>
        {LAYOUT.boxes.map(b => (
          <g key={b.domain}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill="var(--surface)" stroke="var(--border)" />
            <text x={b.x + 10} y={b.y + 16} fontSize="11" fill="var(--text-faint)" style={{ fontFamily: 'var(--font-mono)' }}>
              {b.domain} · {b.name}
            </text>
          </g>
        ))}

        {LAYOUT.edges.map(e => (
          <path key={e.id} d={`M${e.points.map(p => p.join(',')).join(' L')}`} fill="none"
                stroke={e.cross ? 'var(--border-strong)' : 'var(--border)'} strokeWidth="1"
                strokeDasharray={e.cross ? '4 3' : undefined} />
        ))}

        {LAYOUT.nodes.map(n => {
          const built = status.get(n.id) !== 'planned'
          const sel = selectedModule === n.id
          return (
            <g key={n.id} onClick={() => select(n.id)} style={{ cursor: 'pointer' }}>
              {/* Planned nodes render as a BLUEPRINT: dashed, unfilled, dimmed —
                  distinguishable without colour at any zoom. */}
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="3"
                    fill={built ? 'var(--raised)' : 'transparent'}
                    stroke={sel ? 'var(--accent)' : built ? 'var(--border-strong)' : 'var(--border-strong)'}
                    strokeWidth={sel ? 1.75 : 1}
                    strokeDasharray={built ? undefined : '3 2'} />
              <text x={n.x + 7} y={n.y + 17} fontSize="10"
                    fill={built ? 'var(--text)' : 'var(--text-faint)'}
                    opacity={built ? 1 : 0.6}
                    style={{ fontFamily: 'var(--font-mono)' }}>
                {n.id.length > 20 ? n.id.slice(0, 19) + '…' : n.id}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
