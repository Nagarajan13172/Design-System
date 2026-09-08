import { useState } from 'react'
import type { FigureSpec } from '@content/types'
import type { PredictionRecord } from './predictionStore'
import { useAutoFocus } from './useAutoFocus'

/**
 * THE GATE.
 *
 * Three controls, each keyboard-complete, each writing an immutable
 * PredictionRecord before anything reveals.
 *
 * There is deliberately NO skip affordance in any form. A skip would quietly delete
 * the product's core mechanic, and this audience would use it every time.
 */
export interface GateProps {
  figure: FigureSpec
  /** For `rank`: the options to order. For `binary-with-margin`: the two choices. */
  options?: string[]
  onCommit: (r: PredictionRecord) => void
  now?: () => number
}

export function PredictionGate({ figure, options, onCommit, now = () => 0 }: GateProps) {
  const [value, setValue] = useState<number | string | string[] | null>(null)
  const [confidence, setConfidence] = useState(70)
  const ready = value !== null && (!Array.isArray(value) || value.length > 0)

  const commit = () => {
    if (!ready) return
    onCommit({ figureId: figure.id, value: value!, confidence, committedAt: now() })
  }

  return (
    <form
      className="rounded border p-4"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      onSubmit={e => { e.preventDefault(); commit() }}
    >
      <div className="text-[11px] uppercase tracking-wide mb-3" style={{ color: 'var(--text-faint)' }}>
        commit a prediction to reveal the figure
      </div>

      {figure.control === 'point' && <PointControl onChange={setValue} />}
      {figure.control === 'binary-with-margin' && <BinaryControl options={options ?? ['yes', 'no']} value={value as string | null} onChange={setValue} />}
      {figure.control === 'rank' && <RankControl options={options ?? []} onChange={setValue} />}

      <label className="flex items-center gap-2 mt-4" style={{ color: 'var(--text-dim)' }}>
        <span className="text-[11px] uppercase tracking-wide">confidence</span>
        <input type="range" min={50} max={100} step={5} value={confidence}
               onChange={e => setConfidence(Number(e.target.value))} className="w-32"
               aria-label="how confident are you, from 50 to 100 percent" />
        <span className="font-mono">{confidence}%</span>
      </label>

      <div className="flex items-center gap-3 mt-4">
        <button type="submit" disabled={!ready} className="px-3 py-1 rounded text-[13px]"
          style={{
            background: ready ? 'var(--accent)' : 'var(--surface)',
            color: ready ? 'var(--bg)' : 'var(--text-faint)',
            border: '1px solid ' + (ready ? 'var(--accent)' : 'var(--border)'),
            cursor: ready ? 'pointer' : 'not-allowed',
          }}>
          Lock it in
        </button>
        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>↵ · cannot be changed afterwards</span>
      </div>
    </form>
  )
}

function PointControl({ onChange }: { onChange: (v: number | null) => void }) {
  const ref = useAutoFocus<HTMLInputElement>('point')
  return (
    <label className="flex items-center gap-2">
      <input ref={ref} type="number" step="0.1" onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-24 px-2 py-1 rounded border font-mono"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)' }}
        aria-label="your prediction, as a percentage" />
      <span style={{ color: 'var(--text-dim)' }}>% of sessions</span>
    </label>
  )
}

function BinaryControl({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="your prediction" className="grid gap-1.5">
      {options.map((o, i) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className="text-left px-3 py-2 rounded border flex gap-2"
          style={{
            borderColor: value === o ? 'var(--accent)' : 'var(--border-strong)',
            background: value === o ? 'var(--accent-bg)' : 'var(--raised)',
          }}>
          <kbd className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</kbd>
          <span>{o}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Rank: reorder with j/k plus shift, not a drag library.
 * Click-to-move is cheaper to build, keyboard-accessible by construction, and works
 * on a touchscreen — which is three reasons dnd-kit is on the cut list.
 */
function RankControl({ options, onChange }: { options: string[]; onChange: (v: string[]) => void }) {
  const [order, setOrder] = useState<string[]>(options)
  const [sel, setSel] = useState(0)

  const move = (dir: -1 | 1) => {
    const to = sel + dir
    if (to < 0 || to >= order.length) return
    const next = [...order]
    ;[next[sel], next[to]] = [next[to]!, next[sel]!]
    setOrder(next); setSel(to); onChange(next)
  }

  return (
    <div>
      <ol className="grid gap-1.5" aria-label="drag order — use j and k to move, shift to reorder">
        {order.map((o, i) => (
          <li key={o}>
            <button type="button" onClick={() => { setSel(i); onChange(order) }}
              onKeyDown={e => {
                if (e.key === 'j' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (e.shiftKey) move(1); else setSel(Math.min(order.length - 1, i + 1))
                }
                if (e.key === 'k' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (e.shiftKey) move(-1); else setSel(Math.max(0, i - 1))
                }
              }}
              aria-label={`${o}, position ${i + 1} of ${order.length}`}
              className="w-full text-left px-3 py-2 rounded border flex items-center gap-2"
              style={{
                borderColor: sel === i ? 'var(--accent)' : 'var(--border-strong)',
                background: sel === i ? 'var(--accent-bg)' : 'var(--raised)',
              }}>
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</span>
              <span>{o}</span>
              <span className="ml-auto text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {sel === i ? 'shift+j / shift+k to move' : ''}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        Order them first to last. j/k to select, shift+j/shift+k to move.
      </p>
    </div>
  )
}
