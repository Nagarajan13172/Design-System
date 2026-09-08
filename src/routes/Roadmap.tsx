import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation } from '@/lib/nav'
import { MODULES, DOMAINS, BUILT, TOTAL } from 'virtual:manifest-lite'
import { useApp } from '@/store'
import { prefetchModule } from '@/lib/prefetch'

const MapLayer = lazy(() => import('@/features/roadmap/MapLayer'))

/**
 * /roadmap — THE SEMANTIC LIST IS THE PRIMARY DOM, ALWAYS.
 *
 * ADR-6 revised: a pan-zoom canvas is invisible to screen readers and hostile to
 * keyboard users, and this is the least load-bearing screen in the product. So the
 * list is the interface and the canvas is a progressive enhancement layered over it
 * — `aria-hidden`, untabbable, and only loaded on a fine pointer, when idle, and
 * when the user has not asked to save data.
 *
 * That ordering is strictly better on accessibility AND on bytes at the same time,
 * which is why it stopped being a compromise.
 */
export default function Roadmap() {
  const search = useLocation().split('?')[1] ?? ''
  // Both spellings: the plan says `canvas`, the link says `map`. Accepting one and
  // silently ignoring the other is the kind of thing that makes a deep link a bug report.
  const view = new URLSearchParams(search).get('view')
  const wantsMap = view === 'map' || view === 'canvas'
  const [mapAllowed, setMapAllowed] = useState(false)
  const { selectedModule, select, expandedDomains, setDomainOpen } = useApp()

  // The canvas is opt-in on capability, not on viewport width alone.
  useEffect(() => {
    if (!wantsMap) return
    const fine = matchMedia('(pointer: fine)').matches
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection
    if (!fine || conn?.saveData) return
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200))
    const h = idle(() => setMapAllowed(true))
    return () => window.cancelIdleCallback?.(h as number)
  }, [wantsMap])

  const selected = MODULES.find(m => m.id === selectedModule) ?? null

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link to="/review" className="nav-link font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span style={{ color: 'var(--text-dim)' }}>roadmap</span>
        {/* Plain text, no percentage. A progress bar over unwritten content is a promise. */}
        <span className="font-mono text-[12px]" style={{ color: 'var(--text-faint)' }}>
          {BUILT} built · {TOTAL - BUILT} specified
        </span>
        <nav className="ml-auto flex gap-4" style={{ color: 'var(--text-dim)' }}>
          <Link to={wantsMap ? '/roadmap?view=list' : '/roadmap?view=map'} className="nav-link" style={{ color: 'var(--text-dim)' }}>
            {wantsMap ? 'list view' : 'map view'}
          </Link>
          <Link to="/review" className="nav-link" style={{ color: 'var(--text-dim)' }}>review</Link>
        </nav>
      </header>

      <div className="relative">
        <main className="px-5 py-6 mx-auto" style={{ maxWidth: '64rem' }}>
          <p className="mb-6" style={{ color: 'var(--text-dim)', maxWidth: '42rem' }}>
            Every module carries its authored claim and its figure question, whether or not it is
            built. A specified module is a specification, not a stub.
          </p>

          <div className="grid gap-8" style={{ gridTemplateColumns: selected ? 'minmax(0,1fr) 20rem' : 'minmax(0,1fr)' }}>
            <nav aria-label="curriculum">
              <ol className="grid gap-1.5">
                {DOMAINS.map(d => {
                  const mods = MODULES.filter(m => m.domain === d.key)
                  const built = mods.filter(m => m.status !== 'planned').length
                  const open = expandedDomains[d.key] ?? built > 0
                  return (
                    <li key={d.key}>
                      <button onClick={() => setDomainOpen(d.key, !open)} aria-expanded={open}
                              className="w-full flex items-baseline gap-2 px-2 py-1.5 rounded border text-left"
                              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                        <span aria-hidden style={{ color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
                        <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{d.key}</span>
                        <span style={{ color: 'var(--text)' }}>{d.name}</span>
                        <span className="ml-auto font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>
                          {built} built of {mods.length} · {d.tier}
                        </span>
                      </button>

                      {open && (
                        <ol className="mt-1 mb-3 ml-5 grid gap-px" style={{ background: 'var(--border)' }}>
                          {mods.map(m => (
                            <li key={m.id} style={{ background: 'var(--bg)' }}>
                              <ModuleRow id={m.id} title={m.title} status={m.status} level={m.level}
                                         selected={selectedModule === m.id} onSelect={() => select(m.id)} />
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>

            {selected && <NodeBrief id={selected.id} onClose={() => select(null)} />}
          </div>
        </main>

        {mapAllowed && (
          <Suspense fallback={null}>
            <MapLayer />
          </Suspense>
        )}
      </div>
    </div>
  )
}

/** 32px rows. Status is TEXT, never colour alone. */
function ModuleRow({ id, title, status, level, selected, onSelect }: {
  id: string; title: string; status: string; level: string; selected: boolean; onSelect: () => void
}) {
  const built = status !== 'planned'

  const inner = (
    <>
      <span className="font-mono text-[11px] shrink-0" style={{ color: built ? 'var(--accent)' : 'var(--text-faint)', width: '13rem' }}>{id}</span>
      <span className="truncate" style={{ color: built ? 'var(--text)' : 'var(--text-dim)' }}>{title}</span>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-wider shrink-0"
            style={{ color: 'var(--text-faint)' }}>{level} · {built ? status : 'specified'}</span>
    </>
  )

  const style = {
    height: 32, borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
    background: selected ? 'var(--accent-bg)' : undefined,
  }

  return built ? (
    <Link to={`/m/${id}`} id={id} className="nav-link flex items-center gap-3 px-2 w-full"
          style={style} onFocus={onSelect} onMouseEnter={() => { onSelect(); prefetchModule(id) }}>
      {inner}
    </Link>
  ) : (
    <button id={id} onClick={onSelect} onFocus={onSelect}
            className="flex items-center gap-3 px-2 w-full text-left" style={style}>
      {inner}
    </button>
  )
}

/** The authored claim and figure question as REAL CONTENT, for planned nodes too. */
function NodeBrief({ id, onClose }: { id: string; onClose: () => void }) {
  const [full, setFull] = useState<import('@content/types').CurriculumEntry | null>(null)
  useEffect(() => {
    let live = true
    void import('virtual:manifest-full').then(({ FULL }) => {
      if (live) setFull(FULL.find(m => m.id === id) ?? null)
    })
    return () => { live = false }
  }, [id])

  if (!full) return <aside className="text-[13px]" style={{ color: 'var(--text-faint)' }}>loading…</aside>
  const built = full.status !== 'planned'

  return (
    <aside className="text-[13px] sticky top-16 self-start rounded border"
           style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="px-3 py-2 border-b flex items-baseline gap-2" style={{ borderColor: 'var(--border)' }}>
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{full.id}</span>
        <button onClick={onClose} className="ml-auto" style={{ color: 'var(--text-faint)' }} aria-label="clear selection">✕</button>
      </div>
      <div className="px-3 py-3 grid gap-3">
        <h2 style={{ color: 'var(--text)', fontSize: '0.9375rem' }}>{full.title}</h2>
        <p style={{ color: 'var(--text-dim)' }}>{full.oneLiner}</p>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>the figure asks</div>
          <p style={{ color: 'var(--text)' }}>{full.figureQuestion}</p>
        </div>
        <dl className="grid gap-1 font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
          <div className="flex justify-between"><dt>verb</dt><dd style={{ color: 'var(--text)' }}>{full.verb}</dd></div>
          <div className="flex justify-between"><dt>tier</dt><dd style={{ color: 'var(--text)' }}>{full.tier}</dd></div>
          <div className="flex justify-between"><dt>primitive</dt><dd style={{ color: 'var(--text)' }}>{full.primitive}</dd></div>
          <div className="flex justify-between"><dt>study</dt><dd style={{ color: 'var(--text)' }}>{full.studyMinutes} min</dd></div>
        </dl>
        {full.prereqs.length > 0 && (
          <p style={{ color: 'var(--text-dim)' }}>
            Requires {full.prereqs.map((p, i) => (
              <span key={p}>{i > 0 && ' and '}<a href={`#${p}`} style={{ color: 'var(--accent)' }}>{p}</a></span>
            ))} first.
          </p>
        )}
        {full.related.length > 0 && (
          <p style={{ color: 'var(--text-faint)' }}>See also {full.related.join(', ')}.</p>
        )}
        {built
          ? <Link to={`/m/${full.id}`} className="nav-link px-3 py-1.5 rounded text-center"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Open module</Link>
          : <p style={{ color: 'var(--text-faint)' }}>Planned — spec written, build not started.</p>}
      </div>
    </aside>
  )
}
