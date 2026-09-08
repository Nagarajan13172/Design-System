// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Router, Link, matchPath, useParams, Navigate, navigate } from './router'

/**
 * We own the router now (ADR-1, revised), so it owes the same evidence any
 * dependency would: the matcher is correct, modified clicks still belong to the
 * browser, and a route change moves focus — the piece SPAs almost always skip.
 */
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/') })

describe('matchPath', () => {
  it('matches literals and rejects on arity', () => {
    expect(matchPath('/review', '/review')).toEqual({})
    expect(matchPath('/review', '/reviews')).toBeNull()
    expect(matchPath('/dev', '/dev/module/x')).toBeNull()
  })
  it('captures params and decodes them', () => {
    expect(matchPath('/dev/module/:moduleId', '/dev/module/state-races')).toEqual({ moduleId: 'state-races' })
    expect(matchPath('/m/:a/:b', '/m/x%2Fy/z')).toEqual({ a: 'x/y', b: 'z' })
  })
  it('matches root and wildcard', () => {
    expect(matchPath('/', '/')).toEqual({})
    expect(matchPath('*', '/anything/at/all')).toEqual({})
  })
})

const Params = () => <span data-testid="p">{JSON.stringify(useParams())}</span>
const routes = [
  { path: '/', element: <Navigate to="/review" replace /> },
  { path: '/review', element: <h1>review</h1> },
  { path: '/dev/module/:moduleId', element: <Params /> },
  { path: '*', element: <h1>fallback</h1> },
]

describe('Router', () => {
  it('renders the first matching route, in order', () => {
    window.history.replaceState(null, '', '/review')
    render(<Router routes={routes} />)
    expect(screen.getByText('review')).toBeTruthy()
  })

  it('falls through to the wildcard', () => {
    window.history.replaceState(null, '', '/nope')
    render(<Router routes={routes} />)
    expect(screen.getByText('fallback')).toBeTruthy()
  })

  it('provides params to the matched route', () => {
    window.history.replaceState(null, '', '/dev/module/state-races')
    render(<Router routes={routes} />)
    expect(screen.getByTestId('p').textContent).toBe('{"moduleId":"state-races"}')
  })

  it('Navigate redirects without leaving a history entry', () => {
    window.history.replaceState(null, '', '/')
    render(<Router routes={routes} />)
    expect(window.location.pathname).toBe('/review')
  })

  it('Link navigates client-side without a reload', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/review')
    // The wildcard must stay last: routes match in order.
    const withGo = [...routes.slice(0, -1), { path: '/go', element: <Link to="/review">back</Link> }, routes.at(-1)!]
    render(<Router routes={withGo} />)
    await act(async () => { navigate('/go') })
    await user.click(screen.getByText('back'))
    expect(window.location.pathname).toBe('/review')
    expect(screen.getByText('review')).toBeTruthy()
  })

  it('leaves modified clicks to the browser', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/go')
    render(<Router routes={[{ path: '/go', element: <Link to="/review">x</Link> }]} />)
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('x'))
    await user.keyboard('{/Meta}')
    // cmd-click is "open in a new tab" and is not ours to intercept
    expect(window.location.pathname).toBe('/go')
  })

  it('moves focus on route change, so a screen reader is told the page changed', async () => {
    window.history.replaceState(null, '', '/review')
    const { container } = render(<Router routes={routes} />)
    const announcer = container.querySelector('[aria-live="polite"]') as HTMLElement
    expect(announcer).toBeTruthy()
    expect(document.activeElement).not.toBe(announcer)   // not on first paint
    await act(async () => { navigate('/dev/module/x') })
    await vi.waitFor(() => expect(document.activeElement).toBe(announcer))
  })

  it('responds to browser back', async () => {
    window.history.replaceState(null, '', '/review')
    render(<Router routes={routes} />)
    await act(async () => { navigate('/dev/module/a') })
    expect(screen.getByTestId('p')).toBeTruthy()
    await act(async () => { window.history.back() })
    await vi.waitFor(() => expect(screen.getByText('review')).toBeTruthy())
  })
})
