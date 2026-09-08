import type { CodeStageState, CodeToken } from '@content/types'
import type { PrimitiveProps } from './types'

/**
 * CodeStage — pre-tokenized code. ADR-8: Shiki runs at BUILD time and emits ONE
 * `cssVariables` token stream, so light and dark both come free and ZERO
 * highlighter bytes ship. Monaco is ~1MB; Sandpack is a bundler in the browser.
 *
 * Cloze inputs are sized in `ch` so filling one causes no layout shift — in an app
 * that teaches CLS, a drill that reflows while you type would be embarrassing.
 */
export interface CodeStageProps extends PrimitiveProps<CodeStageState> {
  /** Cloze blanks, resolved to token indices at build time. */
  blanks?: { id: string; blockId: string; line: number; token: number }[]
  values?: Record<string, string>
  onBlankChange?: (id: string, value: string) => void
  marks?: Record<string, boolean>
}

export function CodeStage({ state, blanks, values, onBlankChange, marks, labelledBy }: CodeStageProps) {
  if (!state) {
    return (
      <pre className="rounded border p-3 overflow-x-auto" aria-labelledby={labelledBy}
           style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-faint)' }}>
        <code>{'// committed a prediction yet? the code appears after you do'}</code>
      </pre>
    )
  }

  // The palette becomes scoped CSS variables, so both themes come from one token
  // stream and the runtime ships no highlighter at all.
  const paletteCss = state.palette
    ? Object.entries(state.palette).map(([k, v]) => `--shiki-${k}:${v.light};`).join('')
    : ''
  const paletteDark = state.palette
    ? Object.entries(state.palette).map(([k, v]) => `--shiki-${k}:${v.dark};`).join('')
    : ''
  const scope = `cs-${Object.keys(state.palette ?? {}).length}-${state.blocks.map(b => b.id).join('-')}`

  return (
    <div aria-labelledby={labelledBy} className="grid gap-3" data-code-scope={scope}>
      {paletteCss && (
        <style>{
          `[data-code-scope="${scope}"]{${paletteCss}}` +
          `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) [data-code-scope="${scope}"]{${paletteDark}}}` +
          `:root[data-theme="dark"] [data-code-scope="${scope}"]{${paletteDark}}`
        }</style>
      )}
      {state.blocks.filter(b => !state.view || state.view === 'diff' || b.id.includes(state.view.toLowerCase()) || state.blocks.length === 1 || state.blocks.indexOf(b) === (state.view === 'A' ? 0 : 1)).map(block => {
        const hl = state.highlight?.find(h => h.blockId === block.id)
        const changed = state.changed?.find(c => c.blockId === block.id)
        return (
          <figure key={block.id} className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {block.label && (
              <figcaption className="px-3 py-1 text-[11px] border-b font-mono"
                          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-faint)' }}>
                {block.label}
              </figcaption>
            )}
            {/* overflow-x on the block itself: the page body must never scroll sideways */}
            <pre className="p-3 overflow-x-auto" style={{ background: 'var(--raised)', margin: 0 }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.65 }}>
                {block.lines.map((line, li) => {
                  const highlighted = hl?.lines.includes(li)
                  const isChanged = changed?.lines.includes(li)
                  return (
                    <div key={li} style={{
                      display: 'block',
                      // NO tint behind code. Any fill measurably drags Shiki's own
                      // token colours toward the AA floor, so the left border
                      // carries the whole signal — which is also colour-independent.
                      background: undefined,
                      borderLeft: isChanged ? '2px solid var(--accent)'
                        : highlighted ? `2px solid ${hl!.tone === 'bad' ? 'var(--d-error)' : hl!.tone === 'good' ? 'var(--d-work)' : 'var(--accent)'}`
                        : '2px solid transparent',
                      paddingLeft: 6,
                    }}>
                      <span aria-hidden style={{ color: 'var(--text-faint)', userSelect: 'none', marginRight: 12 }}>
                        {String(li + 1).padStart(2, ' ')}
                      </span>
                      {line.map((tok, ti) => {
                        const blank = blanks?.find(b => b.blockId === block.id && b.line === li && b.token === ti)
                        if (blank) {
                          const v = values?.[blank.id] ?? ''
                          const marked = marks?.[blank.id]
                          return (
                            <input key={ti} value={v} onChange={e => onBlankChange?.(blank.id, e.target.value)}
                              disabled={marks != null}
                              aria-label={`blank on line ${li + 1}`}
                              style={{
                                // Sized in `ch` from the expected token, so typing
                                // never reflows the block.
                                width: `${Math.max(tok.text.length, 4)}ch`,
                                fontFamily: 'inherit', fontSize: 'inherit',
                                background: 'var(--surface)', color: 'var(--text)',
                                border: '1px solid ' + (marks == null ? 'var(--border-strong)'
                                  : marked ? 'var(--d-work)' : 'var(--d-error)'),
                                borderRadius: 2, padding: '0 2px',
                              }} />
                          )
                        }
                        return <Tok key={ti} tok={tok} />
                      })}
                    </div>
                  )
                })}
              </code>
            </pre>
          </figure>
        )
      })}
    </div>
  )
}

/** The token stream carries a CSS-variable colour, so themes cost nothing at runtime. */
function Tok({ tok }: { tok: CodeToken }) {
  return <span style={{ color: tok.cls ? `var(--shiki-${tok.cls})` : undefined }}>{tok.text}</span>
}
