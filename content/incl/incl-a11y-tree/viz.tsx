/**
 * The REAL DOM that LiveSurface measures and annotates.
 *
 * This lives beside the sim rather than inside it because the SIM CONTRACT forbids a
 * sim importing React — and because this markup is the thing under test: the
 * overlays resolve against these actual elements, post-layout.
 */
export function renderSurface(props: Record<string, unknown>) {
  const p = props as {
    useAriaLabel?: boolean; useVisibleLabel?: boolean
    usePlaceholder?: boolean; hideIconText?: boolean
  }
  return (
    <form className="flex items-end gap-2" onSubmit={e => e.preventDefault()}>
      <div className="grid gap-1">
        {p.useVisibleLabel && (
          <label htmlFor="a11y-demo-input" className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
            Search products
          </label>
        )}
        <input
          id="a11y-demo-input"
          aria-label={p.useAriaLabel ? 'Search products' : undefined}
          placeholder={p.usePlaceholder ? 'Search…' : undefined}
          className="px-2 py-1.5 rounded border"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text)', width: 220 }}
        />
      </div>
      <button type="submit" className="px-3 py-1.5 rounded border"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <span aria-hidden={p.hideIconText ? true : undefined}>Submit</span>
      </button>
    </form>
  )
}
