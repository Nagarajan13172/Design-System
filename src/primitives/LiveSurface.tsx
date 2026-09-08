import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { LiveSurfaceState } from '@content/types'
import type { PrimitiveProps } from './types'

/**
 * LiveSurface — THE DOCUMENTED EXCEPTION to the eager-timeline contract.
 *
 * Every other primitive renders a precomputed frame. This one renders REAL DOM and
 * overlays annotations anchored to it, because the things it teaches — the
 * accessibility tree, focus order, stacking contexts, layout under real content —
 * are properties of actual layout. `getBoundingClientRect` values do not exist
 * until after layout, so there is no precomputable geometry to put in a frame.
 *
 * The contract instead:
 *   - a sim frame supplies PROP STATES, not coordinates
 *   - anchors resolve post-layout in useLayoutEffect, re-resolved on resize
 *   - the reduced-motion path is a numbered static list, not a composited SVG
 *   - budgeted at 3x a LaneTimeline module, because it is a different animal
 */
export interface LiveSurfaceProps extends PrimitiveProps<LiveSurfaceState> {
  /** Author-supplied. Renders the real DOM the overlays point at. */
  render: (props: Record<string, unknown>) => ReactNode
  /** `shadow` isolates author markup from app styles when the module needs it. */
  isolate?: 'none' | 'shadow'
}

interface Resolved { id: string; rect: DOMRect; text?: string; order?: number; tone?: string; kind: string }

export function LiveSurface({ state, annotations, composite = false, render, labelledBy }: LiveSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [resolved, setResolved] = useState<Resolved[]>([])

  // Post-layout, and again whenever layout changes. This is the whole reason the
  // primitive exists — and the reason it cannot share the eager-frame contract.
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !state) { setResolved([]); return }

    const measure = () => {
      const base = host.getBoundingClientRect()
      const out: Resolved[] = []
      for (const o of state.overlays) {
        const el = host.querySelector(o.selector)
        if (!el) continue
        const r = el.getBoundingClientRect()
        out.push({
          id: o.id, kind: o.kind, text: o.text, order: o.order, tone: o.tone,
          rect: new DOMRect(r.x - base.x, r.y - base.y, r.width, r.height),
        })
      }
      setResolved(out)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    for (const el of host.querySelectorAll('*')) ro.observe(el)
    return () => ro.disconnect()
  }, [state])

  const tone = (t?: string) =>
    t === 'bad' ? 'var(--d-error)' : t === 'good' ? 'var(--d-work)' : 'var(--accent)'

  return (
    <div aria-labelledby={labelledBy}>
      <div className="relative rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--raised)' }}>
        {/* The real DOM. Author-supplied, and genuinely rendered — not a picture of it. */}
        <div ref={hostRef} className="relative">{render(state?.props ?? {})}</div>

        {/* Overlays, absolutely positioned over the measured elements. */}
        {state && (
          <div className="absolute inset-4 pointer-events-none" aria-hidden>
            {resolved.map(r => (
              <div key={r.id} style={{
                position: 'absolute', left: r.rect.x, top: r.rect.y, width: r.rect.width, height: r.rect.height,
                border: `1.5px ${r.kind === 'box' ? 'solid' : 'dashed'} ${tone(r.tone)}`,
                borderRadius: 3,
                transition: 'all 160ms cubic-bezier(.2,0,0,1)',
              }}>
                {r.order != null && (
                  <span style={{
                    position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: 9,
                    background: tone(r.tone), color: 'var(--bg)', fontSize: 10, lineHeight: '18px',
                    textAlign: 'center', fontFamily: 'var(--font-mono)',
                  }}>{r.order}</span>
                )}
                {r.text && (
                  <span style={{
                    position: 'absolute', left: 0, top: -18, fontSize: 10,
                    color: tone(r.tone), fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                  }}>{r.text}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {state?.counters && state.counters.length > 0 && (
        <dl className="mt-3 flex gap-6 flex-wrap">
          {state.counters.map(c => (
            <div key={c.label}>
              <dt className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{c.label}</dt>
              <dd className="font-mono" style={{ color: 'var(--text)' }}>{c.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Reduced motion and screen readers get a numbered list, not a composited SVG:
          there is no geometry to composite, and a list is the honest equivalent. */}
      {state && annotations.length > 0 && (
        <ol className="mt-3 grid gap-1" style={{ fontSize: '0.75rem' }}>
          {annotations.map((a, i) => (
            <li key={a.id} style={{ color: a.tone === 'bad' ? 'var(--d-error)' : a.tone === 'good' ? 'var(--d-work)' : 'var(--text-dim)' }}>
              {composite ? `${i + 1}. ` : '— '}{a.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
