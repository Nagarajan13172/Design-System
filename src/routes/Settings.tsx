import { useEffect, useState } from 'react'
import { Link } from '@/lib/nav'
import { storageHealth, isEvictionProne, shouldNudgeExport, requestPersistence, type StorageHealth } from '@/data/repo/persist'
import { exportAll, planImport, applyImport, type Envelope, type ImportReport } from '@/data/repo/transfer'
import { sessions, prefs, resetRepo, reviews, attempts, cards } from '@/data/repo'

/**
 * /settings — the honest page.
 *
 * With no backend the browser is the only copy, and browsers delete it. Everything
 * here exists because a reassuring UI would be a lie: Safari's ITP evicts IndexedDB
 * for non-installed sites after ~7 days idle, and that is exactly the months-long
 * review history this product's value is made of.
 */
export default function Settings() {
  const [health, setHealth] = useState<StorageHealth | null>(null)
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, attempts: 0, sessions: 0 })
  const [lastExport, setLastExport] = useState<number | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [pending, setPending] = useState<Envelope | null>(null)
  const [confirm, setConfirm] = useState('')
  const [now, setNow] = useState(0)

  const [version, setVersion] = useState(0)
  const refresh = () => setVersion(v => v + 1)

  useEffect(() => {
    let live = true
    void (async () => {
      const [h, c, r, a, s, le] = await Promise.all([
        storageHealth(), cards.all(), reviews.all(), attempts.all(), sessions.all(),
        prefs.get<number | null>('lastExportAt', null),
      ])
      if (!live) return
      setHealth(h)
      setCounts({ cards: c.length, reviews: r.length, attempts: a.length, sessions: s.length })
      setLastExport(le)
      // `now` is read once per refresh rather than during render: Date.now() in a
      // render body is impure and makes the component's output unstable.
      setNow(Date.now())
    })()
    return () => { live = false }
  }, [version])

  const doExport = async () => {
    const env = await exportAll(Date.now(), 'web', 'local')
    const blob = new Blob([JSON.stringify(env)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fesd-progress-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    await prefs.set('lastExportAt', Date.now())
    refresh()
  }

  const nudge = now > 0 && shouldNudgeExport(counts.sessions, lastExport, now)
  const evictionProne = typeof navigator !== 'undefined' && isEvictionProne()

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link to="/review" className="nav-link font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span style={{ color: 'var(--text-dim)' }}>settings</span>
      </header>

      <main className="px-5 py-8 mx-auto grid gap-8" style={{ maxWidth: '44rem' }}>
        <section>
          <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>where your data lives</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            Everything is in this browser and nowhere else. There is no account and no server, which
            means nothing to breach and nothing to subscribe to — and also that a cleared browser,
            a private window, or a long enough gap can take it away.
          </p>

          {nudge && (
            <p className="mt-3 p-3 rounded border" style={{ borderColor: 'var(--accent)', background: 'var(--accent-bg)', color: 'var(--text)' }}>
              {lastExport == null
                ? 'You have never exported. One file is the difference between a gap and a loss.'
                : `Last export ${Math.round((now - lastExport) / 86_400_000)} days ago.`}
            </p>
          )}

          {evictionProne && (
            <p className="mt-3 p-3 rounded border" style={{ borderColor: 'var(--d-blocked)', color: 'var(--text)' }}>
              <strong>On iOS, Safari deletes this after about seven idle days</strong> unless the site
              is added to your home screen. Share → Add to Home Screen makes storage durable. Until
              then, export weekly — this is not a precaution, it is the documented behaviour.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>storage</h2>
          <dl className="grid gap-1 font-mono text-[13px]">
            <Row k="durable (persist granted)" v={health ? (health.persisted ? 'yes' : 'no') : '…'}
                 tone={health?.persisted ? 'good' : 'warn'} />
            <Row k="used" v={health?.usageBytes != null ? `${(health.usageBytes / 1e6).toFixed(1)} MB` : 'unknown'} />
            <Row k="quota" v={health?.quotaBytes != null ? `${(health.quotaBytes / 1e6).toFixed(0)} MB` : 'unknown'} />
            <Row k="cards / reviews / attempts" v={`${counts.cards} / ${counts.reviews} / ${counts.attempts}`} />
            <Row k="sessions" v={String(counts.sessions)} />
            <Row k="last export" v={lastExport ? new Date(lastExport).toISOString().slice(0, 10) : 'never'}
                 tone={lastExport ? undefined : 'warn'} />
          </dl>
          {health && !health.persisted && (
            <button onClick={async () => { await requestPersistence(); refresh() }}
                    className="mt-3 px-3 py-1.5 rounded border"
                    style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              Ask the browser to keep this
            </button>
          )}
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>export and import</h2>
          <p className="mb-3" style={{ color: 'var(--text-dim)' }}>
            Import merges rather than replaces: reviews and attempts are append-only and deduplicated,
            and a card that has seen more history wins. Importing the same file twice does nothing.
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={doExport} className="px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              Export a snapshot
            </button>
            <label className="px-3 py-1.5 rounded border cursor-pointer"
                   style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              Choose a file to import
              <input type="file" accept="application/json" className="sr-only"
                     onChange={async e => {
                       const file = e.target.files?.[0]
                       if (!file) return
                       const env = JSON.parse(await file.text()) as Envelope
                       setPending(env)
                       setReport(await planImport(env))   // DRY RUN — nothing written yet
                     }} />
            </label>
          </div>

          {report && (
            <div className="mt-3 p-3 rounded border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              {!report.ok ? (
                <p style={{ color: 'var(--d-error-text)' }}>{report.errors.join(' ')}</p>
              ) : (
                <>
                  <p className="mb-2" style={{ color: 'var(--text)' }}>Nothing has been written yet. This is what would change:</p>
                  <ul className="font-mono text-[12px]" style={{ color: 'var(--text-dim)' }}>
                    {Object.entries(report.plan).filter(([, p]) => p.incoming > 0).map(([store, p]) => (
                      <li key={store}>{store}: +{p.added} new, {p.duplicate + p.merged} already known</li>
                    ))}
                  </ul>
                  <button onClick={async () => { if (pending) { await applyImport(pending); setReport(null); setPending(null); refresh() } }}
                          className="mt-3 px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                    Apply the merge
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--d-error-text)' }}>delete everything</h2>
          <p className="mb-2" style={{ color: 'var(--text-dim)' }}>
            This cannot be undone and there is no copy anywhere else. Type <code>delete my progress</code> to enable it.
          </p>
          <div className="flex gap-2">
            <input value={confirm} onChange={e => setConfirm(e.target.value)}
                   aria-label="type delete my progress to confirm"
                   className="px-2 py-1.5 rounded border flex-1"
                   style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)' }} />
            <button disabled={confirm !== 'delete my progress'}
                    onClick={async () => { await resetRepo(); setConfirm(''); refresh() }}
                    className="px-3 py-1.5 rounded"
                    style={{
                      background: confirm === 'delete my progress' ? 'var(--d-error)' : 'var(--surface)',
                      color: confirm === 'delete my progress' ? 'var(--bg)' : 'var(--text-faint)',
                      cursor: confirm === 'delete my progress' ? 'pointer' : 'not-allowed',
                    }}>
              Delete
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: 'var(--text-faint)' }}>{k}</dt>
      <dd style={{ color: tone === 'good' ? 'var(--d-work-text)' : tone === 'warn' ? 'var(--d-blocked-text)' : 'var(--text)' }}>{v}</dd>
    </div>
  )
}
