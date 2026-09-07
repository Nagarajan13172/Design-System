import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { loadModule, type LoadedModule } from 'virtual:module-loader'
import { FULL } from 'virtual:manifest-full'
import { MASTERY_KINDS } from '@content/types'
import { Playground } from '@kit/Playground'
import { DevShell } from './DevShell'

/**
 * DEV ONLY. The isolated authoring loop: one module, its figure, its claims and
 * its item coverage, with PROGRESS WRITES DISABLED (the Playground falls back to
 * an in-memory prediction store, so nothing here touches a learner's history).
 *
 * This is the screen that makes module #57 cost 10 hours instead of 25.
 */
export default function DevModule() {
  const { moduleId = '' } = useParams()
  const [mod, setMod] = useState<LoadedModule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const entry = FULL.find(m => m.id === moduleId)

  useEffect(() => {
    let live = true
    setMod(null); setError(null)
    loadModule(moduleId).then(m => { if (live) setMod(m) }, e => { if (live) setError(String(e.message ?? e)) })
    return () => { live = false }
  }, [moduleId])

  if (error) return <DevShell title={moduleId}><p style={{ color: 'var(--d-error)' }}>{error}</p></DevShell>
  if (!mod || !entry) return <DevShell title={moduleId}><p style={{ color: 'var(--text-faint)' }}>loading…</p></DevShell>

  const covered = new Set(mod.items.flatMap(i => [i.primaryClaim, i.secondaryClaim].filter(Boolean)))
  const judgment = mod.items.filter(i => (MASTERY_KINDS as readonly string[]).includes(i.kind))

  return (
    <DevShell title={entry.title}>
      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 20rem' }}>
        <div>
          <Playground meta={mod.meta} setup={entry.figureSetup} run={mod.sim.run} />

          <article className="prose-body mt-8">
            <mod.Body />
          </article>
        </div>

        <aside className="text-[13px]">
          <Panel label="status">
            <Row k="status" v={entry.status} tone={entry.status === 'deep' ? 'good' : 'dim'} />
            <Row k="verb" v={entry.verb} />
            <Row k="primitive" v={entry.primitive} />
            <Row k="reviewedBy" v={mod.meta.reviewedBy ?? 'null'} tone={mod.meta.reviewedBy ? 'good' : 'bad'} />
            <Row k="estimate" v={`${entry.authorHours.estimate}h`} />
            <Row k="actual" v={entry.authorHours.actual ? `${entry.authorHours.actual}h` : 'not recorded'} tone={entry.authorHours.actual ? 'good' : 'dim'} />
          </Panel>

          <Panel label={`claims (${mod.claims.length})`}>
            {mod.claims.map(c => (
              <div key={c.id} className="py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]" style={{ color: covered.has(c.id) ? 'var(--d-work)' : 'var(--d-error)' }}>
                    {covered.has(c.id) ? '✓' : '✕'} {c.id.replace(`${moduleId}-`, '')}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{c.evidence}</span>
                </div>
                <p className="mt-0.5" style={{ color: 'var(--text-dim)' }}>{c.assertion}</p>
              </div>
            ))}
          </Panel>

          <Panel label={`items (${mod.items.length})`}>
            <Row k="judgment / mastery" v={String(judgment.length)} tone={judgment.length >= 12 ? 'good' : 'bad'} />
            <Row k="distinct kinds" v={String(new Set(judgment.map(i => i.kind)).size)} />
            <div className="mt-2 flex flex-wrap gap-1">
              {[...new Set(mod.items.map(i => i.kind))].map(k => (
                <span key={k} className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: (MASTERY_KINDS as readonly string[]).includes(k) ? 'var(--accent-bg)' : 'var(--surface)',
                        color: (MASTERY_KINDS as readonly string[]).includes(k) ? 'var(--accent)' : 'var(--text-faint)',
                        border: '1px solid var(--border)',
                      }}>{k}</span>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </DevShell>
  )
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h3 className="px-3 py-1.5 text-[10px] uppercase tracking-wider border-b"
          style={{ color: 'var(--text-faint)', borderColor: 'var(--border)' }}>{label}</h3>
      <div className="px-3 py-2">{children}</div>
    </section>
  )
}

function Row({ k, v, tone = 'dim' }: { k: string; v: string; tone?: 'good' | 'bad' | 'dim' }) {
  const color = tone === 'good' ? 'var(--d-work)' : tone === 'bad' ? 'var(--d-error)' : 'var(--text)'
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span style={{ color: 'var(--text-faint)' }}>{k}</span>
      <span className="font-mono text-[12px]" style={{ color }}>{v}</span>
    </div>
  )
}
