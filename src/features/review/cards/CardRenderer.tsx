import { useEffect, useRef, useState } from 'react'
import { useAutoFocus } from '@kit/useAutoFocus'
import type { Claim, Item } from '@content/types'
import type { AttemptGrading } from '@/domain/grading/types'

/**
 * Card renderers. Every one is keyboard-first: a review session is a typing rhythm,
 * and reaching for a mouse forty times breaks it.
 *
 * `claim-recall` is the ONLY self-rated kind, and its rating reaches the scheduler
 * through `fromSelfRating` and nothing else. Everything here is auto-graded.
 */
export interface CardProps {
  item: Item
  claim: Claim
  onGrade: (g: AttemptGrading) => void
}

const norm = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ')

/** Edit distance <= 2 counts as correct, with the correction shown. */
function close(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 2) return false
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length]![b.length]! <= 2
}

export function Cloze({ item, claim, onGrade }: CardProps) {
  const payload = item.payload as { blanks?: string[]; accept?: Record<string, string[]> } | undefined
  const blanks = payload?.blanks ?? []
  const [vals, setVals] = useState<string[]>(() => blanks.map(() => ''))
  const [result, setResult] = useState<null | boolean[]>(null)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => { first.current?.focus() }, [item.id])

  const submit = () => {
    if (result) return
    const marks = blanks.map((b, i) => {
      const accepted = [b, ...(payload?.accept?.[i] ?? payload?.accept?.[String(i)] ?? [])].map(norm)
      return accepted.some(a => close(norm(vals[i] ?? ''), a))
    })
    setResult(marks)
  }

  return (
    <form onSubmit={e => {
      e.preventDefault()
      if (!result) { submit(); return }
      onGrade({ kind: 'auto', correct: result.every(Boolean), score: result.filter(Boolean).length / Math.max(1, result.length), latencyMs: 0 })
    }}>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      <div className="flex gap-2 flex-wrap">
        {blanks.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            <input
              ref={i === 0 ? first : undefined}
              value={vals[i] ?? ''} disabled={!!result}
              onChange={e => setVals(v => v.map((x, j) => (j === i ? e.target.value : x)))}
              className="px-2 py-1 rounded border font-mono" style={{
                borderColor: result ? (result[i] ? 'var(--d-work)' : 'var(--d-error)') : 'var(--border-strong)',
                background: 'var(--raised)', color: 'var(--text)', width: `${Math.max(8, b.length + 2)}ch`,
              }}
              aria-label={`blank ${i + 1}`} />
            {result && !result[i] && <span className="font-mono" style={{ color: 'var(--d-work)' }}>{b}</span>}
          </span>
        ))}
      </div>
      <Footer result={result ? result.every(Boolean) : null} claim={claim} submitLabel={result ? 'Continue' : 'Check'} />
    </form>
  )
}

export function McqRationale({ item, claim, onGrade }: CardProps) {
  const p = item.payload as { options: string[]; correct: number; rationales: string[]; correctRationale: number }
  const [stage, setStage] = useState<'option' | 'why' | 'done'>('option')
  const [opt, setOpt] = useState<number | null>(null)
  const [why, setWhy] = useState<number | null>(null)

  const optOk = opt === p.correct
  const whyOk = why === p.correctRationale
  // Right answer, wrong reason scores 0.4 and is reported distinctly: it is the
  // single most useful signal in the whole item set.
  const score = optOk && whyOk ? 1 : optOk ? 0.4 : 0

  return (
    <div>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      <Choices
        legend={stage === 'option' ? 'Pick one' : 'Now pick why'}
        options={stage === 'option' ? p.options : p.rationales}
        value={stage === 'option' ? opt : why}
        correct={stage === 'done' ? (stage === 'done' ? p.correctRationale : -1) : null}
        onPick={i => {
          if (stage === 'option') { setOpt(i); setStage('why') }
          else if (stage === 'why') { setWhy(i); setStage('done') }
        }}
        disabled={stage === 'done'}
      />
      {stage === 'done' && (
        <p className="mt-3" style={{ color: optOk && !whyOk ? 'var(--d-blocked)' : optOk ? 'var(--d-work)' : 'var(--d-error)' }}>
          {optOk && !whyOk ? 'Right answer, wrong reason — that scores 0.4, and it is the most useful signal here.'
            : optOk ? 'Right, for the right reason.' : 'Not this one.'}
        </p>
      )}
      {stage === 'done' && (
        <Footer result={score === 1} claim={claim} submitLabel="Continue"
                onSubmit={() => onGrade({ kind: 'auto', correct: optOk, score, latencyMs: 0 })} />
      )}
    </div>
  )
}

/** The ONLY self-rated kind. Its rating reaches the scheduler; it never reaches Mastery. */
export function ClaimRecall({ item, claim, onGrade }: CardProps) {
  const revealRef = useAutoFocus<HTMLButtonElement>(item.id)
  const [revealed, setRevealed] = useState(false)
  return (
    <div>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      {!revealed ? (
        <button ref={revealRef} onClick={() => setRevealed(true)}
                className="px-3 py-1.5 rounded border"
                style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          Say it out loud, then reveal <kbd className="ml-2 font-mono text-[11px]">space</kbd>
        </button>
      ) : (
        <>
          <blockquote className="p-3 rounded border mb-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)', fontSize: '1rem', lineHeight: 1.7 }}>
            {claim.assertion}
          </blockquote>
          <div className="flex gap-2">
            {([['Again', 1], ['Hard', 2], ['Good', 3], ['Easy', 4]] as const).map(([label, r]) => (
              <button key={r} onClick={() => onGrade({ kind: 'self-rating', rating: r })}
                      className="px-3 py-1.5 rounded border" style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
                {label} <kbd className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{r}</kbd>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px]" style={{ color: 'var(--text-faint)' }}>
            This rating schedules the card. It does not count toward mastery — you cannot grade your own recall into evidence.
          </p>
        </>
      )}
    </div>
  )
}

function Choices({ legend, options, value, correct, onPick, disabled }: {
  legend: string; options: string[]; value: number | null; correct: number | null
  onPick: (i: number) => void; disabled: boolean
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>{legend}</legend>
      <div className="grid gap-1.5">
        {options.map((o, i) => (
          <button key={i} onClick={() => onPick(i)} type="button"
                  className="text-left px-3 py-2 rounded border flex gap-2"
                  style={{
                    borderColor: correct === i ? 'var(--d-work)' : value === i ? 'var(--accent)' : 'var(--border-strong)',
                    background: value === i ? 'var(--accent-bg)' : 'var(--raised)',
                  }}>
            <kbd className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</kbd>
            <span>{o}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Footer({ result, claim, submitLabel, onSubmit }: {
  result: boolean | null; claim: Claim; submitLabel: string; onSubmit?: () => void
}) {
  // A deliberate focus move once the answer is revealed, so Enter continues the
  // session without reaching for the mouse.
  const ref = useAutoFocus<HTMLButtonElement>(result === null ? null : submitLabel)
  return (
    <div className="mt-5 pt-3 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
      <button ref={ref} type={onSubmit ? 'button' : 'submit'} onClick={onSubmit}
              className="px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        {submitLabel} <kbd className="ml-1 font-mono text-[11px] opacity-70">↵</kbd>
      </button>
      {result !== null && (
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>{claim.assertion}</span>
      )}
    </div>
  )
}

export const RENDERERS = { cloze: Cloze, 'mcq-rationale': McqRationale, 'claim-recall': ClaimRecall } as const
export type RenderableKind = keyof typeof RENDERERS
