import { lazy, Suspense, useEffect, useState } from 'react'

const Palette = lazy(() => import('./Palette').then(m => ({ default: m.Palette })))

/**
 * ⌘K / Ctrl-K anywhere. The palette and its index are a separate chunk, so the
 * shortcut costs the landing route only this listener.
 */
export function PaletteHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  if (!open) return null
  return <Suspense fallback={null}><Palette onClose={() => setOpen(false)} /></Suspense>
}
