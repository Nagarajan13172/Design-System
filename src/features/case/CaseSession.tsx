import { useEffect, useRef, useState } from 'react'
import type { CaseSpec } from '@content/types'
import { Canvas } from '@/features/canvas/Canvas'
import { RUNG_MINUTES, HINT_DELAY_SECONDS, scoreAfterHints, type Rung } from '@/domain/case/ladder'
import type { GradeBreakdown } from '@/domain/grading/graph'
import { useAutoFocus } from '@kit/useAutoFocus'

/**
 * THE CASE LADDER, one component, three rungs.
 *
 *   worked — untimed, gated at numbered decision points. Predict, then see why.
 *   faded  — a soft 25-minute clock, hints available after a minute and subtracted.
 *   mini   — 13 minutes, ONE subsystem, no hints, and a different case.
 *
 * The scaffolding comes off in that order deliberately: a learner who has only ever
 * seen a worked example has watched someone else think.
 */
export function CaseSession({ spec, rung, onDone, now = () => Date.now() }: {
  spec: CaseSpec
  rung: Rung
  onDone?: (r: { score: number; hints: number; seconds: number }) => void
  now?: () => number
}) {
  const [elapsed, setElapsed] = useState(0)
  const started = useRef(now())
  const limit = RUNG_MINUTES[rung]

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((now() - started.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [now])

  const overtime = limit != null && elapsed > limit * 60

  return (
    <div>
      <header className="mb-5">
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{rung}</span>
          {limit == null ? (
            <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
              untimed — thinking is the activity here
            </span>
          ) : (
            <span className="font-mono text-[12px]"
                  style={{ color: overtime ? 'var(--d-blocked-text)' : 'var(--text-faint)' }}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} / {limit}:00
              {overtime && rung === 'faded' ? ' · over, but keep going' : ''}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text)', fontSize: '1rem', lineHeight: 1.7, maxWidth: '44rem' }}>{spec.prompt}</p>
      </header>

      {rung === 'worked' && <Worked spec={spec} onDone={onDone} elapsed={elapsed} />}
      {rung === 'faded' && <Faded spec={spec} onDone={onDone} elapsed={elapsed} />}
      {rung === 'mini' && <Mini spec={spec} onDone={onDone} elapsed={elapsed} />}
    </div>
  )
}

/** WORKED — predict at each numbered decision point, then see what it turns on. */
function Worked({ spec, onDone, elapsed }: { spec: CaseSpec; onDone?: (r: { score: number; hints: number; seconds: number }) => void; elapsed: number }) {
  const [at, setAt] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const points = spec.decisionPoints
  const dp = points[at]
  const ref = useAutoFocus<HTMLButtonElement>(at)

  if (!dp) {
    return (
      <Done title={`${right} of ${points.length} decision points called correctly.`}
            body="You have seen the reasoning. The next rung gives you most of the design and takes away the parts it turns on."
            onDone={() => onDone?.({ score: points.length ? right / points.length : 1, hints: 0, seconds: elapsed })} />
    )
  }

  return (
    <section className="rounded border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
      <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
        decision {at + 1} of {points.length}
      </div>
      <p className="mb-3" style={{ color: 'var(--text)', fontSize: '1rem' }}>{dp.question}</p>

      <div className="grid gap-1.5">
        {dp.options.map((o, i) => (
          <button key={o} ref={i === 0 ? ref : undefined} disabled={picked !== null}
                  onClick={() => { setPicked(i); if (i === dp.correct) setRight(r => r + 1) }}
                  className="text-left px-3 py-2 rounded border flex gap-2"
                  style={{
                    borderColor: picked === null ? 'var(--border-strong)'
                      : i === dp.correct ? 'var(--d-work)' : picked === i ? 'var(--d-error)' : 'var(--border)',
                    background: picked === i ? 'var(--accent-bg)' : 'var(--raised)',
                  }}>
            <kbd className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</kbd>
            <span>{o}</span>
          </button>
        ))}
      </div>

      {picked !== null && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* The reasoning is shown whichever way they answered — being right by luck
              and being right for a reason should not look the same. */}
          <p style={{ color: 'var(--text-dim)' }}>{dp.why}</p>
          <button onClick={() => { setAt(a => a + 1); setPicked(null) }}
                  className="mt-3 px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            {at + 1 < points.length ? 'Next decision' : 'Finish the walkthrough'}
          </button>
        </div>
      )}
    </section>
  )
}

/** FADED — build the design yourself, with hints available late and subtracted. */
function Faded({ spec, onDone, elapsed }: { spec: CaseSpec; onDone?: (r: { score: number; hints: number; seconds: number }) => void; elapsed: number }) {
  const [hints, setHints] = useState(0)
  const [result, setResult] = useState<GradeBreakdown | null>(null)
  const [shown, setShown] = useState<string[]>([])

  // Hints unlock after a minute: available immediately, they become the first move.
  const hintsUnlocked = elapsed >= HINT_DELAY_SECONDS
  const available = spec.canvasKey.requiredEdges
    .map(([a, b]) => `Something has to connect ${a} to ${b}.`)
    .filter(h => !shown.includes(h))

  return (
    <div className="grid gap-5">
      <section className="rounded border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
        <h2 className="text-[11px] uppercase tracking-wide mb-3" style={{ color: 'var(--text-faint)' }}>
          the architecture
        </h2>
        <Canvas canvasKey={spec.canvasKey} onGrade={setResult} />
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
          the trade-off ledger — every row needs a flip condition
        </h2>
        <ul className="grid gap-2">
          {spec.ledger.map(l => (
            <li key={l.id} className="rounded border p-3 text-[13px]" style={{ borderColor: 'var(--border)' }}>
              <div style={{ color: 'var(--text)' }}>{l.decision}: <strong>{l.chose}</strong></div>
              <div style={{ color: 'var(--text-dim)' }}>over {l.rejected}</div>
              {/* The flip condition is BLANK in this rung — it is the load-bearing part. */}
              <label className="block mt-2">
                <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>flips when…</span>
                <input className="mt-1 w-full px-2 py-1 rounded border text-[13px]"
                       aria-label={`flip condition for ${l.decision}`}
                       style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)' }} />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button disabled={!hintsUnlocked || !available.length}
                onClick={() => { setHints(h => h + 1); setShown(s => [...s, available[0]!]) }}
                className="px-3 py-1.5 rounded border text-[13px]"
                style={{
                  borderColor: 'var(--border-strong)', background: 'var(--surface)',
                  color: hintsUnlocked ? 'var(--text-dim)' : 'var(--text-faint)',
                  cursor: hintsUnlocked && available.length ? 'pointer' : 'not-allowed',
                }}>
          {hintsUnlocked
            ? `Take a hint (−10% each, ${hints} taken)`
            : `Hints unlock in ${HINT_DELAY_SECONDS - elapsed}s`}
        </button>
        {shown.map(h => (
          <p key={h} className="mt-2 text-[13px]" style={{ color: 'var(--d-blocked-text)' }}>{h}</p>
        ))}
      </section>

      {result && (
        <Done title={`${Math.round(scoreAfterHints(result.score, hints) * 100)}% after ${hints} hint${hints === 1 ? '' : 's'}.`}
              body={hints
                ? 'Hints are subtracted so the number means the same thing every time you see it.'
                : 'No hints. The last rung gives you a different case, one subsystem and a hard clock.'}
              onDone={() => onDone?.({ score: scoreAfterHints(result.score, hints), hints, seconds: elapsed })} />
      )}
    </div>
  )
}

/** MINI — one subsystem, a hard clock, no hints, on a DIFFERENT case. */
function Mini({ spec, onDone, elapsed }: { spec: CaseSpec; onDone?: (r: { score: number; hints: number; seconds: number }) => void; elapsed: number }) {
  const [sub] = useState(() => spec.subsystems[0])
  const [result, setResult] = useState<GradeBreakdown | null>(null)
  const limit = RUNG_MINUTES.mini! * 60
  const out = elapsed > limit

  if (!sub) return <p style={{ color: 'var(--text-faint)' }}>This case has no subsystems defined yet.</p>

  return (
    <div className="grid gap-5">
      <section className="rounded border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <h2 className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-faint)' }}>
          one subsystem only — {sub.label}
        </h2>
        <p style={{ color: 'var(--text)' }}>{sub.focus}</p>
      </section>

      {out ? (
        <Done title="Time." body="A hard clock is the point of this rung — an interviewer will not extend it either. What you had at the bell is the answer."
              onDone={() => onDone?.({ score: result?.score ?? 0, hints: 0, seconds: elapsed })} />
      ) : (
        <>
          <Canvas canvasKey={spec.canvasKey} onGrade={setResult} />
          {result && (
            <Done title={`${Math.round(result.score * 100)}% on a case you had not seen.`}
                  body="That is the number worth trusting: the walkthrough was a different problem wearing different words."
                  onDone={() => onDone?.({ score: result.score, hints: 0, seconds: elapsed })} />
          )}
        </>
      )}
    </div>
  )
}

function Done({ title, body, onDone }: { title: string; body: string; onDone: () => void }) {
  return (
    <section className="rounded border p-4" style={{ borderColor: 'var(--accent)', background: 'var(--accent-bg)' }}>
      <h2 className="font-medium mb-1" style={{ color: 'var(--text)' }}>{title}</h2>
      <p className="mb-3" style={{ color: 'var(--text-dim)' }}>{body}</p>
      <button onClick={onDone} className="px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        Continue
      </button>
    </section>
  )
}
