import { useState } from 'react'
import type { FigureSpec } from '@content/types'
import type { PredictionRecord } from './predictionStore'

/**
 * The gate. The learner must commit before any data exists.
 *
 * There is deliberately NO skip affordance in any form. A skip would quietly
 * delete the product's core mechanic, and this audience would use it every time.
 */
export function PredictionGate({ figure, onCommit }: { figure: FigureSpec; onCommit: (r: PredictionRecord) => void }) {
  const [value, setValue] = useState<string>('')
  const [confidence, setConfidence] = useState(70)
  const ready = value.trim() !== ''

  const commit = () => {
    if (!ready) return
    onCommit({
      figureId: figure.id,
      value: figure.control === 'point' ? Number(value) : value,
      confidence,
      // Committed time comes from the caller in the app; in /dev it is a counter,
      // because a sim may never see a wall clock.
      committedAt: 0,
    })
  }

  return (
    <form
      className="rounded border p-4"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      onSubmit={e => { e.preventDefault(); commit() }}
      onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') commit() }}
    >
      <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: 'var(--text-faint)' }}>
        commit a prediction to reveal the figure
      </div>

      {figure.control === 'point' && (
        <label className="flex items-center gap-2">
          <input
            type="number" step="0.1" autoFocus value={value} onChange={e => setValue(e.target.value)}
            className="w-24 px-2 py-1 rounded border font-mono"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)' }}
            aria-label="your prediction, as a percentage"
          />
          <span style={{ color: 'var(--text-dim)' }}>% of sessions</span>
        </label>
      )}

      {figure.control === 'binary-with-margin' && (
        <div className="flex gap-2">
          {['yes', 'no'].map(v => (
            <button key={v} type="button" onClick={() => setValue(v)}
              className="px-3 py-1 rounded border capitalize"
              style={{
                borderColor: value === v ? 'var(--accent)' : 'var(--border-strong)',
                background: value === v ? 'var(--accent-bg)' : 'var(--raised)',
                color: value === v ? 'var(--accent)' : 'var(--text)',
              }}
              aria-pressed={value === v}>{v}</button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 mt-3" style={{ color: 'var(--text-dim)' }}>
        <span className="text-[11px] uppercase tracking-wide">confidence</span>
        <input type="range" min={50} max={100} step={5} value={confidence}
               onChange={e => setConfidence(Number(e.target.value))} className="w-32"
               aria-label="how confident are you, from 50 to 100 percent" />
        <span className="font-mono">{confidence}%</span>
      </label>

      <div className="flex items-center gap-3 mt-3">
        <button type="submit" disabled={!ready}
          className="px-3 py-1 rounded text-[13px]"
          style={{
            background: ready ? 'var(--accent)' : 'var(--surface)',
            color: ready ? 'var(--bg)' : 'var(--text-faint)',
            border: '1px solid ' + (ready ? 'var(--accent)' : 'var(--border)'),
            cursor: ready ? 'pointer' : 'not-allowed',
          }}>
          Lock it in
        </button>
        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>⌘↵ · cannot be changed afterwards</span>
      </div>
    </form>
  )
}
