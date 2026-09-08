import { useEffect, useState } from 'react'
import { Link } from '@/lib/nav'
import { MODULES } from 'virtual:manifest-lite'
import { BUILT_IDS, loadModule } from 'virtual:module-loader'
import { moduleAxes, reviewForecast, calibration, type ModuleAxes, type CalibrationPoint } from '@/domain/axes'
import { Plot2D } from '@/primitives/Plot2D'

/**
 * /progress — THREE AXES, THREE UNITS, THREE VISUAL LANGUAGES.
 *
 * Coverage is discrete squares (a count). Mastery is a four-band strip (a
 * distribution, and it REFUSES to render a number without enough evidence).
 * Confidence is an outline gauge (a self-report, drawn hollow so it never reads as
 * measurement). They deliberately do not look like components of one number,
 * because they are not, and there is no aggregate anywhere in the type graph.
 */
export default function Progress() {
  const [rows, setRows] = useState<{ id: string; title: string; axes: ModuleAxes }[]>([])
  const [forecast, setForecast] = useState<number[]>([])
  const [points, setPoints] = useState<CalibrationPoint[]>([])

  useEffect(() => {
    void (async () => {
      const now = Date.now()
      const meta = new Map(MODULES.map(m => [m.id, m]))
      const specs: { id: string; claimIds: string[]; tier: 'MVP' | 'tier2' | 'tier3' }[] = []
      const out: { id: string; title: string; axes: ModuleAxes }[] = []
      for (const id of BUILT_IDS) {
        const m = await loadModule(id)
        const claimIds = m.claims.map(c => c.id)
        const lite = meta.get(id)!
        specs.push({ id, claimIds, tier: lite.tier })
        out.push({ id, title: lite.title, axes: await moduleAxes(id, claimIds, now, lite.tier) })
      }
      setRows(out)
      setForecast(await reviewForecast(now, 30))
      setPoints(await calibration(specs, now))
    })()
  }, [])

  const covered = rows.filter(r => r.axes.coverage === 'covered').length

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link to="/review" className="font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span style={{ color: 'var(--text-dim)' }}>progress</span>
        <nav className="ml-auto"><Link to="/review" className="nav-link" style={{ color: 'var(--text-dim)' }}>review</Link></nav>
      </header>

      <main className="px-5 py-10 mx-auto" style={{ maxWidth: '52rem' }}>
        <p className="mb-8 p-3 rounded border text-[13px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-dim)' }}>
          These are three separate measurements in three different units. They are not
          components of one number, and there is deliberately no overall score — a blended
          percentage would hide exactly the gap that matters.
        </p>

        <Panel label="coverage" sub={`${covered} of ${rows.length} built modules`}>
          {/* Discrete squares: a COUNT. Nothing continuous about it. */}
          <div className="flex gap-1 flex-wrap">
            {rows.map(r => (
              <span key={r.id} title={`${r.title} — ${r.axes.coverage}`}
                    style={{
                      width: 14, height: 14, borderRadius: 2,
                      background: r.axes.coverage === 'covered' ? 'var(--accent)' : 'transparent',
                      border: '1px solid ' + (r.axes.coverage === 'covered' ? 'var(--accent)' : 'var(--border-strong)'),
                    }} />
            ))}
          </div>
        </Panel>

        <Panel label="mastery" sub="only auto-graded judgment evidence moves this">
          {/* A four-band strip per module: a DISTRIBUTION, and it refuses to
              render a number without enough evidence. */}
          <ul className="grid gap-2">
            {rows.map(r => {
              const withValue = r.axes.mastery.filter(m => m.result.value != null)
              const enough = withValue.length > 0
              const avg = enough ? withValue.reduce((s, m) => s + m.result.value!, 0) / withValue.length : null
              return (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] w-40 truncate" style={{ color: 'var(--text-faint)' }}>{r.id}</span>
                  <div className="flex-1 flex gap-px" style={{ height: 8 }}>
                    {[0.25, 0.5, 0.75, 1].map(band => (
                      <div key={band} style={{
                        flex: 1,
                        background: avg != null && avg >= band - 0.25 ? 'var(--accent)' : 'var(--border)',
                        opacity: avg != null && avg >= band - 0.25 ? 0.4 + band * 0.6 : 1,
                      }} />
                    ))}
                  </div>
                  <span className="font-mono text-[11px] w-56" style={{ color: enough ? 'var(--text)' : 'var(--text-faint)' }}>
                    {enough ? avg!.toFixed(2) : (r.axes.mastery[0]?.result.reason ?? 'no evidence yet')}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel label="confidence" sub="your own estimate — a self-report, not a measurement">
          {/* Hollow gauges, so they never read as measurement. */}
          <div className="flex gap-3 flex-wrap">
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-1.5">
                <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{r.id.split('-')[0]}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} style={{
                      width: 8, height: 8, borderRadius: 8,
                      border: '1px solid var(--border-strong)',
                      background: (r.axes.confidence ?? 0) >= n ? 'var(--text-dim)' : 'transparent',
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel label="calibration" sub="confidence against measured mastery — points above the line are the interesting ones">
          <Calibration points={points} />
        </Panel>

        <Panel label="review forecast" sub="cards coming due over the next 30 days">
          <Forecast buckets={forecast} />
        </Panel>
      </main>
    </div>
  )
}

/**
 * Both instruments render from the shared Plot2D primitive — its SECOND real client,
 * which is what lets the kit declare it validated. It also deleted ~60 lines of
 * bespoke SVG that duplicated the axis and scale logic.
 */
function Calibration({ points }: { points: CalibrationPoint[] }) {
  if (!points.length) {
    return <p style={{ color: 'var(--text-faint)' }}>Nothing to plot yet — a module needs both a confidence rating and enough mastery evidence.</p>
  }
  const over = points.filter(p => p.confidence > p.mastery + 0.15)
  return (
    <div style={{ maxWidth: 420 }}>
      <Plot2D
        annotations={[]}
        state={{
          xAxis: { label: 'measured mastery', min: 0, max: 1 },
          yAxis: { label: 'confidence', min: 0, max: 1 },
          series: [
            // The y=x reference: over it means rated solid where mastery is unproven.
            { id: 'parity', label: 'y = x', kind: 'line', tone: 'ghost', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
            { id: 'modules', label: 'modules', kind: 'scatter', tone: 'accent', points: points.map(p => ({ x: p.mastery, y: p.confidence })) },
          ],
        }}
      />
      <p className="mt-1 text-[12px]" style={{ color: over.length ? 'var(--d-blocked)' : 'var(--text-faint)' }}>
        {over.length
          ? `${over.length} module${over.length === 1 ? '' : 's'} rated well above measured mastery.`
          : 'Confidence is tracking measurement.'}
      </p>
    </div>
  )
}

function Forecast({ buckets }: { buckets: number[] }) {
  const total = buckets.reduce((s, v) => s + v, 0)
  return (
    <div style={{ maxWidth: 560 }}>
      <Plot2D
        annotations={[]}
        state={{
          xAxis: { label: 'days from today', min: 0, max: Math.max(1, buckets.length - 1) },
          yAxis: { label: 'cards due' },
          series: [{ id: 'due', label: 'due', kind: 'bar', tone: 'accent', points: buckets.map((y, x) => ({ x, y })) }],
          thresholds: buckets[0] ? [{ id: 'today', axis: 'x', value: 0, label: `${buckets[0]} overdue`, tone: 'bad' }] : [],
        }}
      />
      <p className="mt-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>{total} cards over the next {buckets.length} days.</p>
    </div>
  )
}

function Panel({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="mb-9">
      <h2 className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{label}</h2>
      <p className="mb-3 text-[12px]" style={{ color: 'var(--text-dim)' }}>{sub}</p>
      {children}
    </section>
  )
}
