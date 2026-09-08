import { useEffect, useRef, useState } from 'react'
import type { Claim } from '@content/types'
import { tokenPresence, wordCount } from '@/domain/grading/tokens'
import { useAutoFocus } from '@kit/useAutoFocus'

/**
 * THE RECALL GATE — how a module ends.
 *
 * A module cannot be finished with a Next button. The gate takes over the viewport
 * and the page behind it is REMOVED FROM THE DOM by the caller, so scrolling back to
 * the prose is impossible rather than merely discouraged. That distinction is the
 * whole mechanism: a great figure produces the fluency illusion, and the only
 * defence is making the learner produce something from memory with the source gone.
 *
 * AXIS ROUTING (constraint C):
 *   - the gate moves COVERAGE only ('none' -> 'covered')
 *   - it contributes ZERO to Mastery
 *   - self-marks feed NOTHING — not the scheduler, not mastery
 *   - one confidence prompt writes to CONFIDENCE and nowhere else
 */
export interface RecallResult {
  text: string
  words: number
  selfMarks: Record<string, boolean>
  confidence: number | null
  /** Under 8s and under 15 words: no coverage, an honest chip, no punishment. */
  skipped: boolean
}

export interface RecallGateProps {
  moduleTitle: string
  claims: Claim[]
  onComplete: (r: RecallResult) => void
  askConfidence: boolean
  now?: () => number
}

const TARGET_SECONDS = 90

export function RecallGate({ moduleTitle, claims, onComplete, askConfidence, now = () => Date.now() }: RecallGateProps) {
  const [phase, setPhase] = useState<'writing' | 'reveal'>('writing')
  const [text, setText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [marks, setMarks] = useState<Record<string, boolean>>({})
  const [justifying, setJustifying] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const startedAt = useRef(now())
  const ref = useAutoFocus<HTMLTextAreaElement>('recall')

  useEffect(() => {
    if (phase !== 'writing') return
    const t = setInterval(() => setElapsed(Math.round((now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase, now])

  const words = wordCount(text)
  const skipped = elapsed < 8 && words < 15

  // Once submitted the text FREEZES. Editing after seeing the claims would turn a
  // retrieval act into a copying exercise.
  const finish = () => onComplete({ text, words, selfMarks: marks, confidence, skipped })

  if (phase === 'writing') {
    return (
      <Takeover>
        <h2 className="text-[1.0625rem] font-medium mb-1">What did {moduleTitle} actually say?</h2>
        <p className="mb-4" style={{ color: 'var(--text-dim)' }}>
          From memory, in your own words. The page is gone on purpose — that is the point.
        </p>
        <textarea ref={ref} value={text} onChange={e => setText(e.target.value)} rows={9}
          className="w-full p-3 rounded border"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)', fontSize: '1rem', lineHeight: 1.7 }}
          aria-label="write what you remember" />
        <div className="flex items-center gap-4 mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          {/* A soft target, not a limit. A countdown that punishes produces padding. */}
          <span className="font-mono">{words} words</span>
          <span style={{ color: words >= 40 && words <= 120 ? 'var(--d-work)' : 'var(--text-faint)' }}>target 40–120</span>
          <span className="font-mono">{elapsed}s / ~{TARGET_SECONDS}s</span>
          <button onClick={() => setPhase('reveal')} className="ml-auto px-3 py-1.5 rounded"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Done</button>
        </div>
      </Takeover>
    )
  }

  return (
    <Takeover>
      <h2 className="text-[1.0625rem] font-medium mb-3">Compare against what the module claimed</h2>
      <blockquote className="p-3 rounded border mb-5"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', whiteSpace: 'pre-wrap' }}>
        {text || <span style={{ color: 'var(--text-faint)' }}>(nothing written)</span>}
      </blockquote>

      <ul className="grid gap-2 mb-5">
        {claims.map(c => {
          const report = tokenPresence(text, c.conceptTokens)
          const hit = marks[c.id] ?? false
          // Evidence highlighting: flag criteria whose concept tokens are ABSENT
          // from what they actually wrote. A flag, never a score.
          const flagged = !report.allPresent
          return (
            <li key={c.id} className="rounded border p-3" style={{ borderColor: 'var(--border)' }}>
              <p style={{ color: 'var(--text)' }}>{c.assertion}</p>
              {flagged && (
                <p className="mt-1 text-[12px]" style={{ color: 'var(--d-blocked)' }}>
                  You did not write anything resembling: {report.missing.map(g => g[0]).join(', ')}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    // Marking a FLAGGED criterion as hit requires a one-line
                    // justification — friction exactly where self-report is least reliable.
                    if (!hit && flagged) setJustifying(c.id)
                    else setMarks(m => ({ ...m, [c.id]: !hit }))
                  }}
                  aria-pressed={hit} className="px-2 py-1 rounded border text-[12px]"
                  style={{
                    borderColor: hit ? 'var(--d-work)' : 'var(--border-strong)',
                    background: hit ? 'color-mix(in oklch, var(--d-work) 14%, transparent)' : 'var(--raised)',
                    color: hit ? 'var(--d-work)' : 'var(--text-dim)',
                  }}>
                  {hit ? '✓ I said this' : 'I said this'}
                </button>
                {justifying === c.id && (
                  <input placeholder="in one line, what did you say?"
                    className="flex-1 px-2 py-1 rounded border text-[12px]"
                    style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)' }}
                    aria-label={`justify marking "${c.assertion.slice(0, 40)}" as said`}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim().length > 3) {
                        setMarks(m => ({ ...m, [c.id]: true })); setJustifying(null)
                      }
                      if (e.key === 'Escape') setJustifying(null)
                    }} />
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mb-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        These marks are for you. They do not move mastery and they do not schedule anything —
        you cannot grade your own recall into evidence.
      </p>

      {askConfidence && (
        <fieldset className="mb-5">
          <legend className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
            how well could you defend this in an interview?
          </legend>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setConfidence(n)} aria-pressed={confidence === n}
                      className="px-3 py-1.5 rounded border font-mono"
                      style={{
                        borderColor: confidence === n ? 'var(--accent)' : 'var(--border-strong)',
                        background: confidence === n ? 'var(--accent-bg)' : 'var(--raised)',
                      }}>{n}</button>
            ))}
          </div>
        </fieldset>
      )}

      <button onClick={finish} className="px-4 py-2 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        {skipped ? 'Back to review' : 'Mark covered and go back to review'}
      </button>
      {skipped && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          Too fast to count as recall, so this will not be marked covered. No penalty — come back to it.
        </p>
      )}
    </Takeover>
  )
}

function Takeover({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div role="dialog" aria-modal="true" aria-label="recall gate"
         className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto px-5 py-10" style={{ maxWidth: '44rem' }}>{children}</div>
    </div>
  )
}
