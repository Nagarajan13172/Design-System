import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { retryImport } from './lib/retryImport'

// ADR-1: library mode. No loaders, no actions — every read is a local IDB cursor.
const lazyRoute = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(() => retryImport(load))
  return (
    <Suspense fallback={<div className="p-8 text-[color:var(--text-faint)]">loading…</div>}>
      <C />
    </Suspense>
  )
}

/**
 * M1 ships DEV ROUTES ONLY. /review, /m/:id and /roadmap arrive in M2, M3 and M5 —
 * the pipeline is what determines whether this project finishes, so it goes first.
 */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dev" replace /> },
  { path: '/dev', element: lazyRoute(() => import('./routes/DevIndex')) },
  { path: '/dev/module/:moduleId', element: lazyRoute(() => import('./routes/DevModule')) },
  { path: '/dev/primitives', element: lazyRoute(() => import('./routes/DevPrimitives')) },
  { path: '*', element: <Navigate to="/dev" replace /> },
])
