import { Link } from '@/lib/nav'
import { MODULES, DOMAINS, BUILT, TOTAL } from 'virtual:manifest-lite'
import { BUILT_IDS } from 'virtual:module-loader'
import { DevShell } from './DevShell'

/**
 * DEV ONLY. The authoring index: what exists, what is specified, and where the
 * gap is. Deliberately honest — "10 built · 159 specified" as plain text, never a
 * progress bar, because a progress bar on unwritten content is a promise.
 */
export default function DevIndex() {
  const built = new Set(BUILT_IDS)
  return (
    <DevShell title="modules">
      <p className="mb-6" style={{ color: 'var(--text-dim)', maxWidth: '42rem' }}>
        <span className="font-mono" style={{ color: 'var(--text)' }}>{BUILT} built</span>
        <span> · </span>
        <span className="font-mono">{TOTAL - BUILT} specified</span>
        <span>. Specified modules carry their authored claim and figure question but no content —
        they are a specification, not a stub.</span>
      </p>

      {DOMAINS.map(d => {
        const mods = MODULES.filter(m => m.domain === d.key)
        const n = mods.filter(m => built.has(m.id)).length
        return (
          <section key={d.key} className="mb-6">
            <h2 className="flex items-baseline gap-2 mb-2">
              <span className="font-mono text-[12px]" style={{ color: 'var(--text-faint)' }}>{d.key}</span>
              <span style={{ color: 'var(--text)' }}>{d.name}</span>
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {n}/{mods.length} · {d.tier}
              </span>
            </h2>
            <ul className="grid gap-px" style={{ background: 'var(--border)', gridTemplateColumns: 'repeat(auto-fill, minmax(21rem, 1fr))' }}>
              {mods.map(m => {
                const isBuilt = built.has(m.id)
                return (
                  <li key={m.id} style={{ background: 'var(--bg)' }}>
                    {isBuilt ? (
                      <Link to={`/dev/module/${m.id}`} className="flex items-baseline gap-2 px-2 py-1.5">
                        <span className="font-mono text-[11px]" style={{ color: 'var(--accent)' }}>{m.id}</span>
                        <span className="truncate" style={{ color: 'var(--text)' }}>{m.title}</span>
                      </Link>
                    ) : (
                      <div className="flex items-baseline gap-2 px-2 py-1.5">
                        <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{m.id}</span>
                        <span className="truncate" style={{ color: 'var(--text-faint)' }}>{m.title}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </DevShell>
  )
}
