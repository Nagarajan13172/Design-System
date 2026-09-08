import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from '@/lib/nav'
import { loadModule, BUILT_IDS } from 'virtual:module-loader'
import { FULL } from 'virtual:manifest-full'
import { Defence } from '@/features/articulation/Defence'
import { compare } from '@/domain/articulation/defence'
import { ARTICULATION_INTERVAL_DAYS, type DefencePrompt } from '@/domain/articulation/types'
import { defences } from '@/data/repo'
import { CASE_IDS } from 'virtual:cases'
import type { DefenceRow } from '@/data/repo/schema'

/**
 * /practice — the articulation surface, and the entry point for the case ladder.
 *
 * A defence that comes back on its +14 day interval uses the WRITE-NEW-THEN-COMPARE
 * flow: the old answer stays hidden until the new one is locked. Showing it first
 * would turn a retrieval act into an editing one, and the number would mean nothing.
 */
export default function Practice() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [prompts, setPrompts] = useState<{ prompt: DefencePrompt; title: string }[]>([])
  const [due, setDue] = useState<DefenceRow[]>([])
  const [revisit, setRevisit] = useState<DefenceRow | null>(null)
  const [result, setResult] = useState<ReturnType<typeof compare> | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      const loaded = await Promise.all(BUILT_IDS.map(async id => {
        const m = await loadModule(id)
        return m.defence ? { prompt: m.defence, title: FULL.find(f => f.id === id)?.title ?? id } : null
      }))
      const dueRows = await defences.dueBefore(Date.now())
      if (!live) return
      setPrompts(loaded.filter((x): x is { prompt: DefencePrompt; title: string } => !!x))
      setDue(dueRows)
    })()
    return () => { live = false }
  }, [])

  const active = itemId ? prompts.find(p => p.prompt.id === itemId) : null

  // A due defence: write a NEW answer, then compare against the locked one.
  if (revisit && active) {
    return (
      <Shell title="written again">
        {result ? (
          <div className="rounded border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
            <h2 className="font-medium mb-2">
              {result.now} of {result.total} criteria had evidence this time. Fourteen days ago: {result.then}.
            </h2>
            <p className="mb-4" style={{ color: 'var(--text-dim)' }}>
              {result.delta > 0 ? 'The argument covers more ground than it did.'
                : result.delta < 0 ? 'It covers less ground than it did — worth re-reading the module.'
                : 'The same ground, fourteen days later.'}
              {' '}This number is computed from what you wrote, not from how you scored yourself.
            </p>
            <details className="mb-4">
              <summary style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>What you wrote then</summary>
              <blockquote className="mt-2 p-3 rounded border" style={{ borderColor: 'var(--border)', background: 'var(--surface)', whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>
                {revisit.text}
              </blockquote>
            </details>
            <button onClick={() => navigate('/review')} className="px-4 py-2 rounded"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Back to review</button>
          </div>
        ) : (
          <>
            <p className="mb-4" style={{ color: 'var(--text-dim)', maxWidth: '42rem' }}>
              You defended this fourteen days ago. Write it again first — your old answer stays
              hidden until you lock this one.
            </p>
            <Defence prompt={active.prompt} onComplete={async r => {
              const cmp = compare(active.prompt, revisit.text, r.text)
              await defences.put({ ...revisit, revisitedAt: Date.now(), revisitCriteriaWithEvidence: cmp.now })
              setResult(cmp)
            }} />
          </>
        )}
      </Shell>
    )
  }

  if (active) {
    return (
      <Shell title={active.title}>
        <Defence prompt={active.prompt} onComplete={async r => {
          await defences.put({
            id: `${r.promptId}|${r.lockedAt}`, promptId: r.promptId, moduleId: active.prompt.moduleId,
            choiceId: r.choiceId, flipParameter: r.flipParameter, text: r.text, textHash: r.textHash,
            lockedAt: r.lockedAt, words: r.words, overtimeSeconds: r.overtimeSeconds,
            selfScores: r.selfScores, evidence: r.evidence, criteriaWithEvidence: r.criteriaWithEvidence,
            // A FIXED interval. Not scheduled, not FSRS — see the store comment.
            dueAt: r.lockedAt + ARTICULATION_INTERVAL_DAYS * 86_400_000,
            revisitedAt: null, revisitCriteriaWithEvidence: null,
          })
          navigate('/review')
        }} />
      </Shell>
    )
  }

  return (
    <Shell title="practice">
      <p className="mb-6" style={{ color: 'var(--text-dim)', maxWidth: '42rem' }}>
        Trade-off defences train the thing an interview actually scores: saying why, under a clock,
        with the cost named. They are self-scored, so they never move mastery — but the number
        reported when one comes back is computed from what you wrote.
      </p>

      {due.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>due again</h2>
          <ul className="grid gap-1.5">
            {due.map(d => {
              const p = prompts.find(x => x.prompt.id === d.promptId)
              return (
                <li key={d.id}>
                  <button onClick={() => { setRevisit(d); navigate(`/practice/defence/${d.promptId}`) }}
                          className="w-full text-left px-3 py-2 rounded border"
                          style={{ borderColor: 'var(--accent)', background: 'var(--accent-bg)' }}>
                    {p?.prompt.question ?? d.promptId}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>the case ladder</h2>
        <p className="mb-2 text-[13px]" style={{ color: 'var(--text-dim)' }}>
          Worked, then faded, then a different case on a hard clock. The rungs come off in that
          order because someone who has only seen a worked example has watched somebody else think.
        </p>
        <ul className="grid gap-1.5">
          {CASE_IDS.map(id => (
            <li key={id}>
              <Link to={`/practice/case/${id}?stage=worked`} className="nav-link block px-3 py-2 rounded border"
                    style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
                <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{id}</span>
              </Link>
            </li>
          ))}
          {!CASE_IDS.length && <li style={{ color: 'var(--text-faint)' }}>No cases authored yet.</li>}
        </ul>
      </section>

      <h2 className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>trade-off defences</h2>
      <ul className="grid gap-1.5">
        {prompts.map(({ prompt, title }) => (
          <li key={prompt.id}>
            <Link to={`/practice/defence/${prompt.id}`} className="nav-link block px-3 py-2 rounded border"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{title}</span>
              <div style={{ color: 'var(--text)' }}>{prompt.question}</div>
            </Link>
          </li>
        ))}
        {!prompts.length && <li style={{ color: 'var(--text-faint)' }}>No defences authored yet.</li>}
      </ul>
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 px-5 h-11 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link to="/review" className="nav-link font-mono text-[12px]" style={{ color: 'var(--text)' }}>fesd</Link>
        <span style={{ color: 'var(--text-dim)' }}>{title}</span>
        <nav className="ml-auto"><Link to="/review" className="nav-link" style={{ color: 'var(--text-dim)' }}>review</Link></nav>
      </header>
      <main className="px-5 py-8 mx-auto" style={{ maxWidth: '52rem' }}>{children}</main>
    </div>
  )
}
