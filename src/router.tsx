import { lazy, Suspense } from 'react'
import { Navigate, type RouteDef } from './lib/router'
import { retryImport } from './lib/retryImport'

// ADR-1 (revised): our own ~130-line router. No loaders, no actions — every read is
// a local IDB cursor, so a data router was 34kB gz of unused capability.
const lazyRoute = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(() => retryImport(load))
  return (
    <Suspense fallback={<div className="p-8 text-[color:var(--text-faint)]">loading…</div>}>
      <C />
    </Suspense>
  )
}

/**
 * /review is the landing route (M2); /m/:id and /progress arrived in M3, /roadmap in M5.
 * `/` redirects to work, not to a marketing page and not to a map.
 */
export const routes: RouteDef[] = [
  { path: '/', element: <Navigate to="/review" replace /> },
  { path: '/review', element: lazyRoute(() => import('./routes/Review')) },
  { path: '/m/:moduleId', element: lazyRoute(() => import('./routes/Module')) },
  { path: '/progress', element: lazyRoute(() => import('./routes/Progress')) },
  { path: '/roadmap', element: lazyRoute(() => import('./routes/Roadmap')) },
  { path: '/start', element: lazyRoute(() => import('./routes/Start')) },
  { path: '/practice', element: lazyRoute(() => import('./routes/Practice')) },
  { path: '/practice/defence/:itemId', element: lazyRoute(() => import('./routes/Practice')) },
  { path: '/dev', element: lazyRoute(() => import('./routes/DevIndex')) },
  { path: '/dev/module/:moduleId', element: lazyRoute(() => import('./routes/DevModule')) },
  { path: '/dev/primitives', element: lazyRoute(() => import('./routes/DevPrimitives')) },
  { path: '*', element: <Navigate to="/review" replace /> },
]
