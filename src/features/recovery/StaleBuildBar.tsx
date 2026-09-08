import { useEffect, useState } from 'react'
import { isStale, reloadOnce } from '@/lib/buildId'

/**
 * A deploy happened while this tab was open.
 *
 * Announced rather than forced: reloading out from under someone mid-session would
 * lose whatever they were part-way through writing. The bar is polite until they
 * hit a chunk that no longer exists, at which point the error boundary takes over.
 */
export function StaleBuildBar() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let live = true
    const check = () => { void isStale().then(s => { if (live) setStale(s) }) }
    check()
    // On focus, not on a timer: a background tab does not need to know.
    window.addEventListener('focus', check)
    return () => { live = false; window.removeEventListener('focus', check) }
  }, [])

  if (!stale) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-40 px-4 py-2 flex items-center gap-3 border-t"
         style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent)', color: 'var(--text)' }}>
      <span>A new version is available. Your progress is saved either way.</span>
      <button onClick={() => reloadOnce()} className="ml-auto px-3 py-1 rounded"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        Reload
      </button>
    </div>
  )
}
