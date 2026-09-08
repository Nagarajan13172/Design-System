import type { Plot2DState } from '@content/types'
import type { PrimitiveProps } from './types'

/**
 * Plot2D — ONE shared plot behind every instrument in the product.
 *
 * Distributions with percentile marks, budget burndowns, latency histograms, the
 * calibration scatter and the review forecast on /progress all render from this.
 * That is what replaces recharts: a 90kB chart library plus d3 deps for a handful
 * of instruments was pure waste (see the cut list).
 */
const TONE = {
  accent: 'var(--accent)', good: 'var(--d-work)', bad: 'var(--d-error)',
  ghost: 'var(--d-ghost)', neutral: 'var(--text-dim)',
} as const

const PAD = { l: 46, r: 14, t: 14, b: 32 }
const W = 620, H = 260

export function Plot2D({
  state, annotations, ghost, showGhost = true, composite = false, labelledBy,
}: PrimitiveProps<Plot2DState>) {
  // Axes render from the scaffold so the learner sees the space they are predicting
  // in — with no series, which is the data.
  const axes = state ?? ghost
  if (!axes) {
    return <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
                aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : 'empty plot'} />
  }

  const all = [...(state?.series ?? []), ...(showGhost ? ghost?.series ?? [] : [])]
  const pts = all.flatMap(s => s.points)
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const xMin = axes.xAxis.min ?? (xs.length ? Math.min(...xs) : 0)
  const xMax = axes.xAxis.max ?? (xs.length ? Math.max(...xs) : 1)
  const yMin = axes.yAxis.min ?? 0
  const yMax = axes.yAxis.max ?? (ys.length ? Math.max(...ys) * 1.1 : 1)

  const lg = (v: number) => Math.log10(Math.max(v, 1e-6))
  const x = (v: number) => {
    const [a, b, t] = axes.xAxis.scale === 'log' ? [lg(xMin), lg(xMax), lg(v)] : [xMin, xMax, v]
    return PAD.l + ((t - a) / (b - a || 1)) * (W - PAD.l - PAD.r)
  }
  const y = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b)

  const ticks = (min: number, max: number, n = 4) =>
    Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n)

  const path = (s: Plot2DState['series'][number]) => {
    const p = [...s.points].sort((a, b) => a.x - b.x)
    if (!p.length) return ''
    if (s.kind === 'step') {
      return p.map((pt, i) => (i === 0 ? `M${x(pt.x)},${y(pt.y)}` : `H${x(pt.x)}V${y(pt.y)}`)).join(' ')
    }
    return p.map((pt, i) => `${i === 0 ? 'M' : 'L'}${x(pt.x)},${y(pt.y)}`).join(' ')
  }

  const renderSeries = (s: Plot2DState['series'][number], isGhost: boolean) => {
    const stroke = isGhost ? 'var(--d-ghost)' : TONE[s.tone ?? 'accent']
    if (s.kind === 'bar' || s.kind === 'hist') {
      const bw = Math.max(2, (W - PAD.l - PAD.r) / Math.max(1, s.points.length) - 1)
      return s.points.map((p, i) => (
        <rect key={`${s.id}-${i}`} x={x(p.x) - bw / 2} y={y(p.y)} width={bw} height={Math.max(0, y(yMin) - y(p.y))}
              fill={stroke} opacity={isGhost ? 0.4 : 0.85} />
      ))
    }
    if (s.kind === 'scatter') {
      return s.points.map((p, i) => (
        <circle key={`${s.id}-${i}`} cx={x(p.x)} cy={y(p.y)} r="3.5" fill={stroke} opacity={isGhost ? 0.4 : 1} />
      ))
    }
    if (s.kind === 'area') {
      const d = `${path(s)} L${x(s.points.at(-1)!.x)},${y(yMin)} L${x(s.points[0]!.x)},${y(yMin)} Z`
      return <path d={d} fill={stroke} opacity={0.16} stroke={stroke} strokeWidth="1" />
    }
    return <path d={path(s)} fill="none" stroke={stroke} strokeWidth={isGhost ? 1 : 1.75}
                 strokeDasharray={isGhost ? '3 3' : undefined} />
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-labelledby={labelledBy}
         aria-label={labelledBy ? undefined : 'plot'}
         style={{ fontFamily: 'var(--font-mono)' }}>
      {/* Grid and axes: the scaffold, present whether or not data is. */}
      {/* Keyed by INDEX, not value: a flat series (an empty forecast, a constant
          line) makes every tick the same number and collides on key. */}
      {ticks(yMin, yMax).map((v, i) => (
        <g key={`y${i}`}>
          <line x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)} stroke="var(--border)" strokeWidth="0.5" />
          <text x={PAD.l - 6} y={y(v) + 3} fontSize="9" fill="var(--text-faint)" textAnchor="end">{fmt(v)}</text>
        </g>
      ))}
      {ticks(xMin, xMax).map((v, i) => (
        <text key={`x${i}`} x={x(v)} y={H - PAD.b + 14} fontSize="9" fill="var(--text-faint)" textAnchor="middle">{fmt(v)}</text>
      ))}
      <text x={(W + PAD.l) / 2} y={H - 4} fontSize="9" fill="var(--text-faint)" textAnchor="middle">
        {axes.xAxis.label}{axes.xAxis.unit ? ` (${axes.xAxis.unit})` : ''}
      </text>
      <text x={11} y={H / 2} fontSize="9" fill="var(--text-faint)" textAnchor="middle" transform={`rotate(-90 11 ${H / 2})`}>
        {axes.yAxis.label}{axes.yAxis.unit ? ` (${axes.yAxis.unit})` : ''}
      </text>

      {showGhost && ghost?.series.map(s => <g key={`g-${s.id}`}>{renderSeries(s, true)}</g>)}
      {state?.series.map(s => <g key={s.id} data-series={s.id}>{renderSeries(s, false)}</g>)}

      {/* Thresholds: budgets and percentile marks, labelled in place. */}
      {state?.thresholds?.map(t => {
        const tone = t.tone === 'bad' ? 'var(--d-error)' : t.tone === 'good' ? 'var(--d-work)' : 'var(--text-faint)'
        return t.axis === 'x' ? (
          <g key={t.id}>
            <line x1={x(t.value)} y1={PAD.t} x2={x(t.value)} y2={H - PAD.b} stroke={tone} strokeWidth="1" strokeDasharray="3 2" />
            <text x={x(t.value) + 4} y={PAD.t + 10} fontSize="9" fill={tone}>{t.label}</text>
          </g>
        ) : (
          <g key={t.id}>
            <line x1={PAD.l} y1={y(t.value)} x2={W - PAD.r} y2={y(t.value)} stroke={tone} strokeWidth="1" strokeDasharray="3 2" />
            <text x={W - PAD.r - 3} y={y(t.value) - 4} fontSize="9" fill={tone} textAnchor="end">{t.label}</text>
          </g>
        )
      })}

      {state?.markers?.map(m => (
        <g key={m.id}>
          <circle cx={x(m.x)} cy={y(m.y)} r="4" fill="none"
                  stroke={m.tone === 'bad' ? 'var(--d-error)' : m.tone === 'good' ? 'var(--d-work)' : 'var(--accent)'} strokeWidth="1.5" />
          <text x={x(m.x) + 7} y={y(m.y) + 3} fontSize="9" fill="var(--text-dim)">{m.label}</text>
        </g>
      ))}

      {state && annotations.map((a, i) => {
        const at = a.at
        if ('laneId' in at) return null
        const flip = at.x > W * 0.6
        const tone = a.tone === 'bad' ? 'var(--d-error)' : a.tone === 'good' ? 'var(--d-work)' : 'var(--text-dim)'
        return (
          <g key={a.id}>
            <circle cx={x(at.x)} cy={y(at.y)} r="2.5" fill={tone} />
            <text x={flip ? x(at.x) - 6 : x(at.x) + 6} y={y(at.y) - 6} fontSize="9.5" fill={tone}
                  textAnchor={flip ? 'end' : 'start'}>
              {composite ? `${i + 1}. ${a.text}` : a.text}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const fmt = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k`
  : Number.isInteger(v) ? String(v) : v.toFixed(v < 1 ? 2 : 1)
