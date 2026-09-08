import type { StateMatrixState } from '@content/types'
import type { PrimitiveProps } from './types'

/**
 * StateMatrix — 31 modules. Comparison grids, scorecards, decision tables, and the
 * trade-off ledger (whose rows REQUIRE a flip-condition cell, which is the whole
 * point of a ledger as opposed to a pros-and-cons list).
 *
 * The staged reveal walks one cell at a time: that walk is one animated channel,
 * cell fill is the second, and there is never a third.
 */
const TONE = {
  pass: { bg: 'color-mix(in oklch, var(--d-work) 16%, transparent)', fg: 'var(--d-work-text)', mark: '✓' },
  fail: { bg: 'color-mix(in oklch, var(--d-error) 16%, transparent)', fg: 'var(--d-error-text)', mark: '✕' },
  partial: { bg: 'color-mix(in oklch, var(--d-blocked) 16%, transparent)', fg: 'var(--d-blocked-text)', mark: '~' },
  na: { bg: 'transparent', fg: 'var(--text-faint)', mark: '–' },
  active: { bg: 'var(--accent-bg)', fg: 'var(--accent)', mark: '' },
  empty: { bg: 'transparent', fg: 'var(--text-faint)', mark: '' },
} as const

export function StateMatrix({ state, annotations, composite = false, labelledBy }: PrimitiveProps<StateMatrixState>) {
  const rows = state?.rows ?? []
  const cols = state?.cols ?? []

  return (
    <div aria-labelledby={labelledBy}>
      <table className="w-full border-collapse" style={{ fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            <th className="text-left font-medium p-2 border-b" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-dim)', width: '30%' }} />
            {cols.map(c => (
              <th key={c.id} className="text-left font-medium p-2 border-b"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-dim)' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <th scope="row" className="text-left font-normal p-2 border-b align-top"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>{r.label}</th>
              {cols.map(c => {
                const cell = state?.cells[`${r.id}:${c.id}`]
                const isCursor = state?.cursor?.row === r.id && state?.cursor?.col === c.id
                const t = TONE[cell?.state ?? 'empty']
                return (
                  <td key={c.id} className="p-2 border-b align-top"
                      style={{
                        borderColor: 'var(--border)',
                        background: isCursor ? 'var(--accent-bg)' : t.bg,
                        color: cell ? t.fg : 'var(--text-faint)',
                        outline: isCursor ? '1px solid var(--accent)' : undefined,
                        transition: 'background 160ms cubic-bezier(.2,0,0,1)',
                      }}>
                    {/* The mark carries the meaning without colour. */}
                    {cell ? <span>{t.mark} {cell.value ?? ''}</span> : <span aria-hidden>·</span>}
                    {cell?.note && <div style={{ color: 'var(--text-faint)', fontSize: '0.6875rem', marginTop: 2 }}>{cell.note}</div>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {state?.meter && (
        <div className="mt-3 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
          <span>{state.meter.label}</span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="h-full rounded-full" style={{ width: `${(state.meter.value / state.meter.max) * 100}%`, background: 'var(--accent)', transition: 'width 200ms cubic-bezier(.2,0,0,1)' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{state.meter.value}{state.meter.unit ?? ''}</span>
        </div>
      )}

      {state && annotations.length > 0 && (
        <ul className="mt-3 space-y-1" style={{ fontSize: '0.75rem' }}>
          {annotations.map((a, i) => (
            <li key={a.id} style={{ color: a.tone === 'bad' ? 'var(--d-error)' : a.tone === 'good' ? 'var(--d-work)' : 'var(--text-dim)' }}>
              {composite ? `${i + 1}. ` : '— '}{a.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
