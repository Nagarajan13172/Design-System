import { useEffect, useRef, useState } from 'react'
import { useAutoFocus } from '@kit/useAutoFocus'
import { wordCount } from '@/domain/grading/tokens'
import {
  hashText, reportCriteria, criteriaWithEvidence, canScoreAbove, type CriterionReport,
} from '@/domain/articulation/defence'
import { WRITE_SECONDS, WORD_FLOOR, type DefencePrompt, type DefenceRecord } from '@/domain/articulation/types'

/**
 * TRADE-OFF DEFENCE — five phases, and each one locks behind it.
 *
 * The order matters: choose before writing (so the writing defends a position),
 * write before revealing (so the model answer cannot be paraphrased), lock before
 * scoring (so the text cannot be improved once the criteria are visible).
 */
export function Defence({ prompt, onComplete, now = () => Date.now() }: {
  prompt: DefencePrompt
  onComplete: (r: DefenceRecord) => void
  now?: () => number
}) {
  const [phase, setPhase] = useState<'choose' | 'write' | 'reveal'>('choose')
  const [choice, setChoice] = useState<string | null>(null)
  const [flip, setFlip] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [reports, setReports] = useState<CriterionReport[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [refusal, setRefusal] = useState<Record<string, string>>({})
  const started = useRef<number | null>(null)
  const locked = useRef<{ hash: string; at: number } | null>(null)
  const ref = useAutoFocus<HTMLTextAreaElement>(phase)

  // The clock starts at the FIRST KEYSTROKE, not when the page loads — thinking
  // before writing is the behaviour we want, not the one to penalise.
  useEffect(() => {
    if (phase !== 'write' || started.current == null) return
    const t = setInterval(() => setElapsed(Math.round((now() - started.current!) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase, now])

  const words = wordCount(text)
  const canLock = words >= WORD_FLOOR
  const overtime = Math.max(0, elapsed - WRITE_SECONDS)

  const lock = async () => {
    if (!canLock) return
    locked.current = { hash: await hashText(text), at: now() }
    setReports(reportCriteria(prompt, text))
    setPhase('reveal')
  }

  const finish = () => {
    if (!locked.current || !choice) return
    onComplete({
      promptId: prompt.id, choiceId: choice, flipParameter: flip, text,
      textHash: locked.current.hash, lockedAt: locked.current.at,
      words, overtimeSeconds: overtime, selfScores: scores, evidence,
      criteriaWithEvidence: criteriaWithEvidence(prompt, text),
    })
  }

  if (phase === 'choose') {
    return (
      <Wrap prompt={prompt}>
        {/* No "it depends" option exists. The escape hatch is naming the parameter. */}
        <fieldset>
          <legend className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
            pick one — there is no "it depends"
          </legend>
          <div className="grid gap-1.5">
            {prompt.options.map((o, i) => (
              <button key={o.id} onClick={() => setChoice(o.id)} aria-pressed={choice === o.id}
                      className="text-left px-3 py-2 rounded border flex gap-2"
                      style={{
                        borderColor: choice === o.id ? 'var(--accent)' : 'var(--border-strong)',
                        background: choice === o.id ? 'var(--accent-bg)' : 'var(--raised)',
                      }}>
                <kbd className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</kbd>
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block mt-4">
          <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>
            if it depends, name what on (optional)
          </span>
          <select value={flip ?? ''} onChange={e => setFlip(e.target.value || null)}
                  className="mt-1 w-full px-2 py-1.5 rounded border"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)' }}>
            <option value="">—</option>
            {prompt.options.filter(o => o.flipParameter).map(o => (
              <option key={o.id} value={o.flipParameter!}>{o.flipParameter}</option>
            ))}
          </select>
        </label>

        <button disabled={!choice} onClick={() => setPhase('write')}
                className="mt-5 px-4 py-2 rounded"
                style={{
                  background: choice ? 'var(--accent)' : 'var(--surface)',
                  color: choice ? 'var(--bg)' : 'var(--text-faint)',
                  cursor: choice ? 'pointer' : 'not-allowed',
                }}>
          Now defend it
        </button>
      </Wrap>
    )
  }

  if (phase === 'write') {
    return (
      <Wrap prompt={prompt}>
        <p className="mb-3" style={{ color: 'var(--text-dim)' }}>
          Why that one? Name what it costs and what would change your mind. Four minutes.
        </p>
        <textarea ref={ref} value={text} rows={10}
          onChange={e => { if (started.current == null) started.current = now(); setText(e.target.value) }}
          className="w-full p-3 rounded border"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)', fontSize: '1rem', lineHeight: 1.7 }}
          aria-label="your justification" />
        <div className="flex items-center gap-4 mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          <span className="font-mono" style={{ color: canLock ? 'var(--d-work-text)' : 'var(--text-faint)' }}>
            {words}/{WORD_FLOOR} words
          </span>
          <span className="font-mono" style={{ color: overtime > 0 ? 'var(--d-blocked-text)' : 'var(--text-faint)' }}>
            {elapsed}s{overtime > 0 ? ` · ${overtime}s over` : ` / ${WRITE_SECONDS}s`}
          </span>
          <button onClick={() => void lock()} disabled={!canLock} className="ml-auto px-3 py-1.5 rounded"
                  style={{
                    background: canLock ? 'var(--accent)' : 'var(--surface)',
                    color: canLock ? 'var(--bg)' : 'var(--text-faint)',
                    cursor: canLock ? 'pointer' : 'not-allowed',
                  }}>
            Lock
          </button>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          Locking is final. You cannot edit this once you have seen the criteria.
        </p>
      </Wrap>
    )
  }

  const allScored = prompt.criteria.every(c => scores[c.id] != null)

  return (
    <Wrap prompt={prompt}>
      <blockquote className="p-3 rounded border mb-5"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', whiteSpace: 'pre-wrap' }}>
        {text}
      </blockquote>

      <ul className="grid gap-3 mb-5">
        {reports.map(r => {
          const score = scores[r.criterion.id]
          return (
            <li key={r.criterion.id} className="rounded border p-3" style={{ borderColor: 'var(--border)' }}>
              <p style={{ color: 'var(--text)' }}>{r.criterion.label}</p>

              {!r.hasEvidence && (
                <p className="mt-1 text-[12px]" style={{ color: 'var(--d-blocked-text)' }}>
                  You did not write anything resembling: {r.missing.map(g => g[0]).join(', ')}
                </p>
              )}

              <dl className="mt-2 grid gap-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
                {(['weak', 'adequate', 'strong'] as const).map(level => (
                  <div key={level} className="flex gap-2">
                    <dt className="font-mono shrink-0" style={{ color: 'var(--text-faint)', width: '5rem' }}>{level}</dt>
                    <dd>{r.criterion.anchors[level]}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {[0, 1, 2, 3].map(n => (
                  <button key={n} aria-pressed={score === n}
                          onClick={() => {
                            const verdict = canScoreAbove(r, n, evidence[r.criterion.id], text)
                            if (!verdict.allowed) {
                              setRefusal(f => ({ ...f, [r.criterion.id]: verdict.reason! }))
                              return
                            }
                            setRefusal(f => ({ ...f, [r.criterion.id]: '' }))
                            setScores(s => ({ ...s, [r.criterion.id]: n }))
                          }}
                          className="px-2.5 py-1 rounded border font-mono text-[12px]"
                          style={{
                            borderColor: score === n ? 'var(--accent)' : 'var(--border-strong)',
                            background: score === n ? 'var(--accent-bg)' : 'var(--raised)',
                          }}>{n}</button>
                ))}
                {!r.hasEvidence && (
                  <input placeholder="paste the words you wrote that cover this"
                         value={evidence[r.criterion.id] ?? ''}
                         onChange={e => setEvidence(v => ({ ...v, [r.criterion.id]: e.target.value }))}
                         aria-label={`evidence for: ${r.criterion.label}`}
                         className="flex-1 min-w-[14rem] px-2 py-1 rounded border text-[12px]"
                         style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)' }} />
                )}
              </div>
              {refusal[r.criterion.id] && (
                <p className="mt-1.5 text-[12px]" style={{ color: 'var(--d-error-text)' }}>{refusal[r.criterion.id]}</p>
              )}
            </li>
          )
        })}
      </ul>

      <details className="mb-5">
        <summary style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>The answer this was written against</summary>
        <p className="mt-2 p-3 rounded border" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-dim)' }}>
          {prompt.modelAnswer}
        </p>
      </details>

      <p className="mb-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        These scores are yours. They do not move mastery and they do not schedule anything —
        you cannot grade your own argument into evidence. In fourteen days you will write this
        again, and the number reported then is computed, not self-assigned.
      </p>

      <button onClick={finish} disabled={!allScored} className="px-4 py-2 rounded"
              style={{
                background: allScored ? 'var(--accent)' : 'var(--surface)',
                color: allScored ? 'var(--bg)' : 'var(--text-faint)',
                cursor: allScored ? 'pointer' : 'not-allowed',
              }}>
        Done
      </button>
    </Wrap>
  )
}

function Wrap({ prompt, children }: { prompt: DefencePrompt; children: React.ReactNode }) {
  return (
    <section className="rounded border" style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
      <div className="px-4 pt-4">
        <p style={{ color: 'var(--text-dim)', maxWidth: '46rem' }}>{prompt.situation}</p>
        <h2 className="font-medium mt-1" style={{ color: 'var(--text)' }}>{prompt.question}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
