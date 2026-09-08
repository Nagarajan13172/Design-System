import { useState } from 'react'
import type { CodeStageState } from '@content/types'
import { CodeStage } from '@/primitives/CodeStage'
import { withinEditDistance } from '@/domain/grading'
import type { AutoGrading } from '@/domain/grading/types'
import type { DrillProps } from './Drill'

/**
 * CODE DRILLS — ADR-8. The code is tokenized at build time and the blanks are
 * resolved to positions there too, so a drill costs a token array and no runtime
 * highlighter.
 *
 * What is lost versus a real editor: the learner cannot execute anything or see a
 * type error. Cloze and consequence-prediction cover the teaching goal; free-form
 * authoring does not, and it is not what a design interview tests.
 */
const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9_$.-]/g, '')

interface CodePayload {
  stage?: CodeStageState
  blanks?: { id: string; blockId: string; line: number; token: number; expected: string }[]
  accept?: Record<string, string[]>
  /** code-diff: which block exhibits the failure, and what class of defect it is. */
  correctHunk?: number
  defectClass?: string
  hunks?: string[]
  classes?: string[]
}

export function CodeCloze({ item, onDone }: DrillProps) {
  const p = (item.payload ?? {}) as CodePayload
  const blanks = p.blanks ?? []
  const [values, setValues] = useState<Record<string, string>>({})
  const [marks, setMarks] = useState<Record<string, boolean> | null>(null)

  const check = () => {
    if (marks) return
    const m: Record<string, boolean> = {}
    for (const b of blanks) {
      const alts = [b.expected, ...(p.accept?.[b.id] ?? [])].map(norm)
      m[b.id] = alts.some(a => withinEditDistance(norm(values[b.id] ?? ''), a))
    }
    setMarks(m)
  }

  const done = () => {
    const hits = Object.values(marks ?? {}).filter(Boolean).length
    const score = blanks.length ? hits / blanks.length : 0
    onDone({ kind: 'auto', correct: score === 1, score, latencyMs: 0 } satisfies AutoGrading)
  }

  if (!p.stage) return <Unavailable />

  return (
    <div>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      <CodeStage state={p.stage} annotations={[]} blanks={blanks} values={values} marks={marks ?? undefined}
                 onBlankChange={(id, v) => setValues(s => ({ ...s, [id]: v }))} />
      <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {marks ? (
          <>
            <p style={{ color: Object.values(marks).every(Boolean) ? 'var(--d-work)' : 'var(--text)' }}>
              {Object.values(marks).filter(Boolean).length}/{blanks.length} right.
              {!Object.values(marks).every(Boolean) && ' The expected tokens are shown in the boxes you missed.'}
            </p>
            <ul className="mt-1 text-[12px]" style={{ color: 'var(--text-dim)' }}>
              {blanks.filter(b => !marks[b.id]).map(b => (
                <li key={b.id}>line {b.line + 1}: <code style={{ color: 'var(--d-work)' }}>{b.expected}</code></li>
              ))}
            </ul>
            <button onClick={done} className="mt-3 px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
              Continue
            </button>
          </>
        ) : (
          <button onClick={check} className="px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            Check
          </button>
        )}
      </div>
    </div>
  )
}

/** code-diff: predict the consequence, reveal B, then name the defect class. */
export function CodeDiff({ item, onDone }: DrillProps) {
  const p = (item.payload ?? {}) as CodePayload
  const [view, setView] = useState<'A' | 'B'>('A')
  const [hunk, setHunk] = useState<number | null>(null)
  const [cls, setCls] = useState<number | null>(null)

  if (!p.stage) return <Unavailable />
  const hunks = p.hunks ?? []
  const classes = p.classes ?? [p.defectClass ?? 'this defect', 'a different defect']
  const graded = hunk != null && cls != null

  const finish = () => {
    const hunkOk = hunk === (p.correctHunk ?? 0)
    const clsOk = cls === 0
    const score = (hunkOk ? 0.5 : 0) + (clsOk ? 0.5 : 0)
    onDone({ kind: 'auto', correct: hunkOk && clsOk, score, latencyMs: 0 } satisfies AutoGrading)
  }

  return (
    <div>
      <p className="mb-4" style={{ fontSize: '1rem', lineHeight: 1.7 }}>{item.prompt}</p>
      <div className="flex gap-1 mb-2">
        {(['A', 'B'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                  className="px-2 py-1 rounded border text-[12px] font-mono"
                  style={{
                    borderColor: view === v ? 'var(--accent)' : 'var(--border-strong)',
                    background: view === v ? 'var(--accent-bg)' : 'var(--raised)',
                  }}>version {v}</button>
        ))}
      </div>
      <CodeStage state={{ ...p.stage, view }} annotations={[]} />
      <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {hunk == null ? (
          <Pick legend="Which version exhibits the failure?" options={hunks.length ? hunks : ['A', 'B']} onPick={setHunk} />
        ) : cls == null ? (
          <Pick legend="What class of defect is it?" options={classes} onPick={setCls} />
        ) : null}
        {graded && (
          <button onClick={finish} className="mt-3 px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}

function Pick({ legend, options, onPick }: { legend: string; options: string[]; onPick: (i: number) => void }) {
  return (
    <fieldset>
      <legend className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>{legend}</legend>
      <div className="grid gap-1.5">
        {options.map((o, i) => (
          <button key={o} onClick={() => onPick(i)} type="button"
                  onKeyDown={e => { const n = Number(e.key); if (n >= 1 && n <= options.length) { e.preventDefault(); onPick(n - 1) } }}
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

/**
 * Code drills are desktop-only: a cloze over tokenized source needs a keyboard and
 * a wide viewport. The deferral is SURFACED rather than degraded — a shrunken,
 * unusable drill teaches nothing and reads as a bug.
 */
function Unavailable() {
  return (
    <div className="rounded border border-dashed p-4" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-faint)' }}>
      This code drill has no build-time token stream yet.
    </div>
  )
}
