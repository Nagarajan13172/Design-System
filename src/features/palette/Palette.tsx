import { useEffect, useMemo, useState } from 'react'
import { useAutoFocus } from '@kit/useAutoFocus'
import { useNavigate } from '@/lib/nav'
import { useApp } from '@/store'
import { run, parse, type Hit } from './search'

/**
 * ⌘K. Lazy-loaded with its index, so it costs the landing route nothing.
 *
 * The MODE CHIP is visible before you press Enter: typing `>` or `@` changes what
 * the next keystroke will search, and a palette that hides that until you commit is
 * a palette people stop trusting.
 */
export function Palette({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('')
  const [sel, setSel] = useState(0)
  const navigate = useNavigate()
  const setTheme = useApp(s => s.setTheme)
  const theme = useApp(s => s.theme)

  const { mode, hits } = useMemo(() => run(input), [input])
  // A deliberate focus move into a dialog the user just opened, not an autoFocus
  // that fires on mount regardless of context.
  const inputRef = useAutoFocus<HTMLInputElement>('palette')

  // Escape closes from ANYWHERE inside the dialog, not only from the input. Binding
  // it to the field alone meant a stray focus made the palette unclosable by
  // keyboard — which is a trap, not a shortcut.
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])

  const activate = (h: Hit) => {
    onClose()
    if (h.mode === 'command' && h.id === 'theme') { void setTheme(theme === 'dark' ? 'light' : 'dark'); return }
    if (h.mode === 'command' || h.mode === 'route') { navigate(h.id); return }
    if (h.mode === 'domain') { navigate('/roadmap'); return }
    navigate(`/m/${h.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      {/* A real <button> backdrop rather than a div with a click handler: it is
          focusable, it is announced, and Escape is not the only way out. */}
      <button type="button" aria-label="close the command palette" onClick={onClose}
              className="absolute inset-0"
              style={{ background: 'color-mix(in oklch, var(--bg) 72%, transparent)' }} />
      <div role="dialog" aria-modal="true" aria-label="command palette"
           className="relative w-full rounded border overflow-hidden"
           style={{ maxWidth: '36rem', borderColor: 'var(--border-strong)', background: 'var(--raised)' }}>
        <div className="flex items-center gap-2 px-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{mode}</span>
          <input
            ref={inputRef} value={input}
            onChange={e => { setInput(e.target.value); setSel(0) }}
            placeholder="search modules · > commands · @ domains · / routes"
            aria-label="search"
            className="flex-1 py-3 bg-transparent outline-none"
            style={{ color: 'var(--text)', fontSize: '0.9375rem' }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(hits.length - 1, s + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
              if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); activate(hits[sel]!) }
            }} />
        </div>

        {parse(input).mode === 'claim' && (
          <p className="px-3 py-3 text-[13px]" style={{ color: 'var(--text-faint)' }}>
            Claim search needs a module’s content loaded — open a module and use its claims ledger.
          </p>
        )}

        <ul className="max-h-[52vh] overflow-y-auto">
          {hits.map((h, i) => (
            <li key={`${h.mode}-${h.id}`}>
              <button onClick={() => activate(h)} onMouseEnter={() => setSel(i)}
                      className="w-full text-left px-3 py-2 flex items-baseline gap-3"
                      style={{ background: i === sel ? 'var(--accent-bg)' : undefined }}>
                <span className="font-mono text-[11px] shrink-0" style={{ color: 'var(--accent)', width: '12rem' }}>{h.id}</span>
                <span className="truncate" style={{ color: 'var(--text)' }}>{h.title}</span>
                <span className="ml-auto font-mono text-[10px] shrink-0" style={{ color: 'var(--text-faint)' }}>{h.sub}</span>
              </button>
            </li>
          ))}
          {!hits.length && input && parse(input).mode !== 'claim' && (
            <li className="px-3 py-3" style={{ color: 'var(--text-faint)' }}>Nothing matches.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
