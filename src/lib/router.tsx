import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode, type MouseEvent } from 'react'

/**
 * THE ROUTER. ~130 lines, replacing react-router.
 *
 * ADR-1 (revised): react-router v7 is 34kB gz — a third of the landing budget — for
 * twelve static routes with no loaders, no actions, no nested layouts and no data
 * APIs, all of which the original ADR-1 had already forbidden. We were paying for a
 * data router and using a path matcher.
 *
 * Same reasoning as ADR-5 (no animation library) and ADR-6 (no graph library): when
 * the library's value is the part we deliberately don't use, hand-rolling the part
 * we do use is smaller AND simpler. An app whose thesis is bundle discipline is
 * measured on its own landing page first.
 *
 * What this deliberately does NOT do: loaders, actions, nested/relative routes,
 * search-param helpers, blockers, transitions. If any of those is ever needed,
 * that is a new ADR, not a quiet addition here.
 */

export interface RouteDef {
  /** '/', '/review', '/dev/module/:moduleId', '*' */
  path: string
  element: ReactNode
}

// --- the location store -----------------------------------------------------
const listeners = new Set<() => void>()
const notify = () => { for (const l of listeners) l() }

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  window.addEventListener('popstate', fn)
  return () => { listeners.delete(fn); window.removeEventListener('popstate', fn) }
}
const getSnapshot = () => window.location.pathname + window.location.search
const getServerSnapshot = () => '/'

export function navigate(to: string, opts?: { replace?: boolean }) {
  if (to === getSnapshot()) return
  if (opts?.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  notify()
}

export function useLocation() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// --- matching ---------------------------------------------------------------
type Params = Record<string, string>

export function matchPath(pattern: string, pathname: string): Params | null {
  if (pattern === '*') return {}
  const p = pattern.split('/').filter(Boolean)
  const a = pathname.split('/').filter(Boolean)
  if (p.length !== a.length) return null
  const params: Params = {}
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(a[i]!)
    else if (seg !== a[i]) return null
  }
  return params
}

const ParamsContext = createContext<Params>({})
export const useParams = () => useContext(ParamsContext)
export const useNavigate = () => navigate

// --- components -------------------------------------------------------------
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  // In an effect, not during render: navigating during render is a side effect.
  useEffect(() => { navigate(to, { replace }) }, [to, replace])
  return null
}

export function Link(
  { to, children, ...rest }: { to: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    rest.onClick?.(e)
    // Leave modified clicks and non-primary buttons to the browser: cmd-click to
    // open in a new tab is not ours to intercept.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (rest.target && rest.target !== '_self') return
    e.preventDefault()
    navigate(to)
  }
  return <a {...rest} href={to} onClick={onClick}>{children}</a>
}

/**
 * Focus and announcement on route change.
 *
 * A client-side navigation does not move focus or tell a screen reader anything —
 * the page silently becomes a different page. This is the fix, and it is the single
 * most commonly skipped piece of SPA accessibility.
 */
function RouteAnnouncer({ path }: { path: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    ref.current?.focus()
    window.scrollTo(0, 0)
  }, [path])
  return <div ref={ref} tabIndex={-1} style={{ outline: 'none' }} aria-live="polite" />
}

export function Router({ routes }: { routes: RouteDef[] }) {
  const path = useLocation()
  const pathname = path.split('?')[0]!

  // Not memoized: matching a dozen patterns is a handful of string splits, and a
  // memo here costs more than it saves.
  let matched: { route: RouteDef; params: Params } | null = null
  for (const r of routes) {
    const params = matchPath(r.path, pathname)
    if (params) { matched = { route: r, params }; break }
  }

  if (!matched) return null
  return (
    <ParamsContext.Provider value={matched.params}>
      <RouteAnnouncer path={pathname} />
      {matched.route.element}
    </ParamsContext.Provider>
  )
}
