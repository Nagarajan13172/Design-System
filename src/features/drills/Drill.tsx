import { useState } from 'react'
import type { Item } from '@content/types'
import { gradeAttempt, type Response } from '@/domain/grading'
import type { AttemptGrading, AutoGrading } from '@/domain/grading/types'
import { useAutoFocus } from '@kit/useAutoFocus'

/**
 * Drill renderers, over the shared grading dispatcher.
 * Keyboard-complete: number keys pick, j/k move, Enter continues.
 */
export interface DrillProps {
  item: Item
  onDone: (g: AttemptGrading, explanation?: string) => void
}

/** Drills are auto-graded by construction — that is what makes them drills. */
interface Graded { grading: AutoGrading; explanation?: string }

function useGrade(item: Item, onDone: DrillProps['onDone']) {
  const [result, setResult] = useState<Graded | null>(null)
  const submit = (r: Response) => { if (!result) setResult(gradeAttempt(item, r, 0)) }
  const advance = () => { if (result) onDone(result.grading, result.explanation) }
  return { result, submit, advance }
}

/**
 * CONSTRAINT-FLIP — the workhorse.
 *
 * Two screens: which way does it move, then by how much. It makes trade-off
 * judgment gradable in forty seconds, and it generates mechanically from a claim's
 * `flipCondition` plus a parameter bank.
 */
export function ConstraintFlip({ item, onDone }: DrillProps) {
  const p = (item.payload ?? {}) as { direction?: string; bands?: string[]; flipParameter?: string }
  const dirs = p.direction === 'yes' || p.direction === 'no' ? ['yes', 'no']
    : p.direction === 'url' ? (p.bands ?? []) : ['up', 'down', 'no change']
  const twoPhase = dirs !== p.bands
  const [dir, setDir] = useState<string | null>(null)
  const { result, submit, advance } = useGrade(item, onDone)
  const ref = useAutoFocus<HTMLButtonElement>(item.id)

  return (
    <div>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      {result ? (
        <Verdict result={result} onContinue={advance}
                 hint={p.flipParameter ? `The parameter that decides it: ${p.flipParameter}.` : undefined} />
      ) : !twoPhase ? (
        <Choices legend="Pick one" options={dirs} onPick={i => submit({ kind: 'constraint-flip', direction: p.direction ?? '', band: i })} firstRef={ref} />
      ) : !dir ? (
        <Choices legend="Which way does it move?" options={dirs} onPick={i => setDir(dirs[i]!)} firstRef={ref} />
      ) : (
        <Choices legend={`By how much? (you said "${dir}")`} options={p.bands ?? []}
                 onPick={i => submit({ kind: 'constraint-flip', direction: dir, band: i })} />
      )}
    </div>
  )
}

/** ORDER-STEPS — j/k to select, shift to move. No drag library (see the cut list). */
export function OrderSteps({ item, onDone }: DrillProps) {
  const p = (item.payload ?? {}) as { steps?: string[] }
  const [order, setOrder] = useState<number[]>(() => (p.steps ?? []).map((_, i) => i).reverse())
  const [sel, setSel] = useState(0)
  const { result, submit, advance } = useGrade(item, onDone)

  const move = (dir: -1 | 1) => {
    const to = sel + dir
    if (to < 0 || to >= order.length) return
    const next = [...order]
    const a = next[sel]!, b = next[to]!
    next[sel] = b; next[to] = a
    setOrder(next); setSel(to)
  }

  return (
    <div>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      <ol className="grid gap-1.5">
        {order.map((stepIdx, i) => (
          <li key={stepIdx}>
            <button type="button" disabled={!!result} onClick={() => setSel(i)}
              onKeyDown={e => {
                if (e.key === 'j' || e.key === 'ArrowDown') {
                  e.preventDefault(); if (e.shiftKey) move(1); else setSel(Math.min(order.length - 1, i + 1))
                }
                if (e.key === 'k' || e.key === 'ArrowUp') {
                  e.preventDefault(); if (e.shiftKey) move(-1); else setSel(Math.max(0, i - 1))
                }
              }}
              aria-label={`${p.steps?.[stepIdx]}, position ${i + 1} of ${order.length}`}
              className="w-full text-left px-3 py-2 rounded border flex items-center gap-2"
              style={{
                borderColor: sel === i ? 'var(--accent)' : 'var(--border-strong)',
                background: sel === i ? 'var(--accent-bg)' : 'var(--raised)',
              }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</span>
              <span>{p.steps?.[stepIdx]}</span>
            </button>
          </li>
        ))}
      </ol>
      {result ? <Verdict result={result} onContinue={advance} /> : (
        <>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>j/k to select · shift+j / shift+k to move</p>
          <button onClick={() => submit({ kind: 'order-steps', order })}
                  className="mt-3 px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            Check <kbd className="ml-1 font-mono text-[11px] opacity-70">↵</kbd>
          </button>
        </>
      )}
    </div>
  )
}

/** SPOT-THE-FAILURE — click the hit region, then name the failure class. */
export function SpotTheFailure({ item, onDone }: DrillProps) {
  const p = (item.payload ?? {}) as { regions?: string[]; classes?: string[]; hitRegion?: string; failureClass?: string }
  const regions = p.regions ?? [p.hitRegion ?? 'here', 'somewhere earlier', 'somewhere later']
  const classes = p.classes ?? [p.failureClass ?? 'this class', 'a different class']
  const [region, setRegion] = useState<string | null>(null)
  const { result, submit, advance } = useGrade(item, onDone)

  return (
    <div>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      {result ? <Verdict result={result} onContinue={advance} />
        : !region ? <Choices legend="Where does it go wrong?" options={regions} onPick={i => setRegion(regions[i]!)} />
        : <Choices legend="What class of failure is it?" options={classes}
                   onPick={i => submit({ kind: 'spot-the-failure', region, failureClass: classes[i]! })} />}
    </div>
  )
}

function Choices({ legend, options, onPick, firstRef }: {
  legend: string; options: string[]; onPick: (i: number) => void; firstRef?: React.Ref<HTMLButtonElement>
}) {
  return (
    <fieldset>
      <legend className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>{legend}</legend>
      <div className="grid gap-1.5">
        {options.map((o, i) => (
          <button key={o} ref={i === 0 ? firstRef : undefined} onClick={() => onPick(i)} type="button"
                  // Number keys work whenever focus is anywhere in the group, which
                  // is what makes the strip usable without leaving the keyboard.
                  onKeyDown={e => {
                    const n = Number(e.key)
                    if (n >= 1 && n <= options.length) { e.preventDefault(); onPick(n - 1) }
                  }}
                  className="text-left px-3 py-2 rounded border flex gap-2"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
            <kbd className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</kbd>
            <span>{o}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Verdict({ result, onContinue, hint }: { result: Graded; onContinue: () => void; hint?: string }) {
  const ref = useAutoFocus<HTMLButtonElement>('verdict')
  const full = result.grading.score === 1
  const partial = !full && result.grading.score > 0
  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
      <p style={{ color: full ? 'var(--d-work)' : partial ? 'var(--d-blocked)' : 'var(--text)' }}>
        {full ? 'Right, for the right reason.'
          : partial ? `Partly — ${Math.round(result.grading.score * 100)}%.`
          : 'Not this one.'}
      </p>
      {result.explanation && <p className="mt-1" style={{ color: 'var(--text-dim)' }}>{result.explanation}</p>}
      {hint && !full && <p className="mt-1" style={{ color: 'var(--text-faint)' }}>{hint}</p>}
      <button ref={ref} onClick={onContinue} className="mt-3 px-3 py-1.5 rounded"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        Continue <kbd className="ml-1 font-mono text-[11px] opacity-70">↵</kbd>
      </button>
    </div>
  )
}

export const DRILLS = {
  'constraint-flip': ConstraintFlip,
  'order-steps': OrderSteps,
  'spot-the-failure': SpotTheFailure,
} as const
export type DrillKind = keyof typeof DRILLS
