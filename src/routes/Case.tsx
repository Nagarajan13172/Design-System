import { useEffect, useState } from 'react'
import { Link, useParams, useLocation, useNavigate } from '@/lib/nav'
import { loadCase, CASE_IDS } from 'virtual:cases'
import type { CaseSpec } from '@content/types'
import { CaseSession } from '@/features/case/CaseSession'
import type { Rung } from '@/domain/case/ladder'

/**
 * /practice/case/:caseId?stage=worked|faded|mini
 *
 * The mini rung SWITCHES CASE, to the spec's declared independent partner. Doing it
 * here rather than asking the learner to navigate is the point: the ladder decides
 * what you practise on, because a learner choosing for themselves picks the case
 * they just watched.
 */
const RUNGS: Rung[] = ['worked', 'faded', 'mini']

export default function Case() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const search = useLocation().split('?')[1] ?? ''
  const stage = (new URLSearchParams(search).get('stage') ?? 'worked') as Rung

  const [spec, setSpec] = useState<CaseSpec | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    // The independent rung runs on the PARTNER, not on the case just walked through.
    void (async () => {
      try {
        const base = await loadCase(caseId)
        const target = stage === 'mini' && base.independentPartner
          ? await loadCase(base.independentPartner)
          : base
        if (live) { setSpec(target); setError(null) }
      } catch (e) { if (live) setError(String((e as Error).message)) }
    })()
    return () => { live = false }
  }, [caseId, stage])

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link to="/review" className="nav-link font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span style={{ color: 'var(--text-dim)' }}>case ladder</span>
        <nav className="ml-auto flex gap-3">
          {RUNGS.map(r => (
            <Link key={r} to={`/practice/case/${caseId}?stage=${r}`}
                  className="nav-link font-mono text-[12px]"
                  style={{ color: r === stage ? 'var(--accent)' : 'var(--text-dim)' }}>
              {r}
            </Link>
          ))}
        </nav>
      </header>

      <main className="px-5 py-8 mx-auto" style={{ maxWidth: '52rem' }}>
        {error && <p style={{ color: 'var(--d-error-text)' }}>{error}</p>}
        {!spec && !error && <p style={{ color: 'var(--text-faint)' }}>loading…</p>}

        {spec && (
          <>
            {stage === 'mini' && spec.id !== caseId && (
              <p className="mb-5 p-3 rounded border text-[13px]"
                 style={{ borderColor: 'var(--accent)', background: 'var(--accent-bg)', color: 'var(--text)' }}>
                This rung runs on a <strong>different case</strong> — {spec.id}. It is the same shape of
                problem and none of the same surface, which is the only way to tell transfer from recall.
              </p>
            )}
            <CaseSession
              spec={spec} rung={stage}
              onDone={() => {
                const next = RUNGS[RUNGS.indexOf(stage) + 1]
                navigate(next ? `/practice/case/${caseId}?stage=${next}` : '/practice')
              }} />
          </>
        )}

        {!spec && !error && CASE_IDS.length === 0 && (
          <p style={{ color: 'var(--text-faint)' }}>No cases authored yet.</p>
        )}
      </main>
    </div>
  )
}
