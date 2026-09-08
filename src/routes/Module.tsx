import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from '@/lib/nav'
import { loadModule, type LoadedModule } from 'virtual:module-loader'
import { FULL } from 'virtual:manifest-full'
import type { Item } from '@content/types'
import { Playground } from '@kit/Playground'
import { DRILLS, type DrillKind } from '@/features/drills/Drill'
import { RecallGate, type RecallResult } from '@/features/recall/RecallGate'
import { markCovered, recordConfidence, shouldAskConfidence, moduleAxes, type ModuleAxes } from '@/domain/axes'
import { attempts, cards } from '@/data/repo'
import { useIdbPredictionStore } from '@kit/useIdbPredictionStore'
import type { AttemptGrading } from '@/domain/grading/types'
import { MODULES } from 'virtual:manifest-lite'

/**
 * /m/:moduleId — THE TEACHING UNIT.
 *
 * Orient, then the figure (gated), then the drills, then the recall gate. There is
 * no Next button anywhere on this page: the only way out is through the gate, and
 * the gate REMOVES THE PAGE FROM THE DOM so scrolling back is impossible.
 */
export default function Module() {
  const { moduleId = '' } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<{ id: string; mod: LoadedModule | null; error: string | null }>({ id: '', mod: null, error: null })
  const [axes, setAxes] = useState<ModuleAxes | null>(null)
  const [drillIndex, setDrillIndex] = useState(0)
  const [inRecall, setInRecall] = useState(false)
  const [askConfidence, setAskConfidence] = useState(false)
  const entry = FULL.find(m => m.id === moduleId)
  const { store: predictionStore, ready: storeReady } = useIdbPredictionStore(moduleId)

  useEffect(() => {
    let live = true
    loadModule(moduleId).then(
      m => { if (live) setLoaded({ id: moduleId, mod: m, error: null }) },
      e => { if (live) setLoaded({ id: moduleId, mod: null, error: String(e.message ?? e) }) },
    )
    return () => { live = false }
  }, [moduleId])

  const mod = loaded.id === moduleId ? loaded.mod : null
  const error = loaded.id === moduleId ? loaded.error : null

  // A version counter rather than a callback in the dep array: recomputing the axes
  // is a read, and re-running it must not be entangled with the identity of a fn.
  const [axesVersion, setAxesVersion] = useState(0)
  const refreshAxes = useCallback(() => setAxesVersion(v => v + 1), [])

  useEffect(() => {
    if (!mod || !entry) return
    let live = true
    void (async () => {
      const a = await moduleAxes(moduleId, mod.claims.map(c => c.id), Date.now(), entry.tier)
      if (live) setAxes(a)
    })()
    return () => { live = false }
  }, [mod, entry, moduleId, axesVersion])

  useEffect(() => {
    if (!moduleId) return
    let live = true
    void (async () => {
      const ask = await shouldAskConfidence(moduleId, Date.now())
      if (live) setAskConfidence(ask)
    })()
    return () => { live = false }
  }, [moduleId])

  if (error) return <Shell title={moduleId}><p style={{ color: 'var(--d-error)' }}>{error}</p></Shell>
  if (!mod || !entry || !storeReady) return <Shell title={moduleId}><p style={{ color: 'var(--text-faint)' }}>loading…</p></Shell>

  const gateItem = mod.items.find(i => i.kind === 'predict')
  const drills = mod.items.filter((i): i is Item => i.kind in DRILLS)
  const currentDrill = drills[drillIndex]

  const recordAttempt = async (item: Item, grading: AttemptGrading) => {
    const ts = Date.now()
    const prior = await attempts.byClaim(item.primaryClaim)
    const rehearsal = prior.some(a => a.itemId === item.id && ts - a.ts < 30 * 86_400_000)
    await attempts.append([{
      id: `${item.id}|${ts}`, itemId: item.id, moduleId, claimId: item.primaryClaim,
      itemKind: item.kind, ts, grading, rehearsal,
    }])
    refreshAxes()
  }

  const onRecallComplete = async (r: RecallResult) => {
    const now = Date.now()
    // AXIS ROUTING, in one place: coverage from the gate, confidence from the prompt,
    // and the self-marks going nowhere at all.
    if (!r.skipped) await markCovered(moduleId, now)
    if (r.confidence != null) await recordConfidence(moduleId, r.confidence, now)
    navigate('/review')
  }

  // The gate takes over and the page is REMOVED — not covered, not scrolled past.
  if (inRecall) {
    return (
      <RecallGate moduleTitle={entry.title} claims={mod.claims}
                  askConfidence={askConfidence} onComplete={onRecallComplete} />
    )
  }

  return (
    <Shell title={entry.title}>
      {/* Two columns only at >= 1280px. Below that the ledger stacks under the
          prose rather than squeezing the figure, which is the thing worth reading. */}
      <div className="grid gap-8 module-grid">
        <div>
          <Playground
            meta={mod.meta} setup={entry.figureSetup} run={mod.sim.run} gateItem={gateItem}
            renderSurface={mod.renderSurface}
            now={() => Date.now()}
            store={predictionStore}
            onCommit={(_r, correct) => {
              if (gateItem) void recordAttempt(gateItem, { kind: 'auto', correct, score: correct ? 1 : 0, latencyMs: 0 })
            }}
          />

          <article className="prose-body mt-10"><mod.Body /></article>

          {drills.length > 0 && (
            <section className="mt-10 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-[11px] uppercase tracking-wide mb-4" style={{ color: 'var(--text-faint)' }}>
                drills · {drillIndex + (currentDrill ? 1 : 0)}/{drills.length}
              </h2>
              {currentDrill ? (
                <DrillSlot key={currentDrill.id} item={currentDrill}
                  onDone={async g => { await recordAttempt(currentDrill, g); setDrillIndex(i => i + 1) }} />
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>Drills done.</p>
              )}
            </section>
          )}

          {/* THE ONLY WAY OUT. No Next button exists on this page. */}
          <footer className="mt-10 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setInRecall(true)} className="px-4 py-2 rounded"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              Close the page and write what you remember
            </button>
            <p className="mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              This is how a module ends. There is no Next.
            </p>
            <NextSuggestion moduleId={moduleId} domain={entry.domain} />
          </footer>
        </div>

        <aside className="module-aside">
          <ClaimsLedger claims={mod.claims} axes={axes} />
        </aside>
      </div>
    </Shell>
  )
}

function DrillSlot({ item, onDone }: { item: Item; onDone: (g: AttemptGrading) => void }) {
  const C = DRILLS[item.kind as DrillKind]
  return <C item={item} onDone={onDone} />
}

/** 4-8 claims as rows, each showing whether it has evidence — not a score. */
function ClaimsLedger({ claims, axes }: { claims: LoadedModule['claims']; axes: ModuleAxes | null }) {
  return (
    <section className="rounded border sticky top-16" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h2 className="px-3 py-1.5 text-[10px] uppercase tracking-wider border-b"
          style={{ color: 'var(--text-faint)', borderColor: 'var(--border)' }}>
        claims · {axes ? `${axes.claimsWithEvidence}/${axes.totalClaims} with evidence` : '…'}
      </h2>
      <ul className="px-3 py-2">
        {claims.map(c => {
          const m = axes?.mastery.find(x => x.claimId === c.id)?.result
          return (
            <li key={c.id} className="py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[13px]" style={{ color: 'var(--text)' }}>{c.assertion}</p>
              <p className="mt-1 font-mono text-[11px]" style={{ color: m?.value != null ? 'var(--d-work)' : 'var(--text-faint)' }}>
                {/* Never a zero. A refusal to render a number IS the information. */}
                {m == null ? '—' : m.value == null ? m.reason : `mastery ${m.value.toFixed(2)}`}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Interleaved: the suggestion deliberately leaves this domain. */
function NextSuggestion({ moduleId, domain }: { moduleId: string; domain: string }) {
  const [next, setNext] = useState<string | null>(null)
  useEffect(() => {
    void (async () => {
      const built = MODULES.filter(m => m.status !== 'planned' && m.id !== moduleId)
      const other = built.filter(m => m.domain !== domain)
      const all = await cards.all()
      const seen = new Set(all.filter(c => c.reps > 0).map(c => c.moduleId))
      setNext((other.find(m => !seen.has(m.id)) ?? other[0] ?? built[0])?.id ?? null)
    })()
  }, [moduleId, domain])
  if (!next) return null
  return (
    <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
      Afterwards, something from a different domain: <Link to={`/m/${next}`} style={{ color: 'var(--text-dim)' }}>{next}</Link>
    </p>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b sticky top-0 z-10"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <Link to="/review" className="font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span style={{ color: 'var(--text-dim)' }}>{title}</span>
        <nav className="ml-auto flex gap-4" style={{ color: 'var(--text-dim)' }}>
          <Link to="/progress" className="nav-link" style={{ color: 'var(--text-dim)' }}>progress</Link>
          <Link to="/review" className="nav-link" style={{ color: 'var(--text-dim)' }}>review</Link>
        </nav>
      </header>
      <main className="px-5 py-8 mx-auto" style={{ maxWidth: '72rem' }}>{children}</main>
    </div>
  )
}
