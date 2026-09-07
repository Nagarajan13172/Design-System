/**
 * Each `it('claim:<id>')` asserts the sim against the claim that cites it.
 *
 * This is the only test in the codebase that can catch the worst bug this product
 * can ship: teaching something that is not true. The numbers in claims.ts were read
 * off these assertions, not the other way round.
 */
import { describe, it, expect } from 'vitest'
import { measure, run, DEFAULTS } from './sim'
import claims from './claims'

const at = (o: Partial<typeof DEFAULTS>) => measure({ ...DEFAULTS, sessions: 400, ...o })

describe('state-races sim', () => {
  it('claim:state-races-c1 — dispatch order does not determine arrival order', () => {
    // If arrival always matched dispatch, no naive session could ever end stale.
    expect(at({}).staleRate).toBeGreaterThan(0)
    expect(at({ debounceMs: 0 }).staleRate).toBeGreaterThan(0.1)
  })

  it('claim:state-races-c3 — debounce shrinks the race window but cannot close it', () => {
    const none = at({ debounceMs: 0 }).staleRate
    const some = at({ debounceMs: 300 }).staleRate
    expect(some).toBeLessThan(none)          // it shrinks
    expect(some).toBeGreaterThan(0)          // and it does NOT close

    // Monotone in the debounce interval, which is what makes it a window and not a fix.
    const rates = [0, 100, 200, 300, 500].map(d => at({ debounceMs: d }).staleRate)
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeLessThanOrEqual(rates[i - 1]!)
  })

  it('claim:state-races-c4 — a sequence guard eliminates stale renders without cancelling', () => {
    for (const p95 of [480, 900, 1500, 2500]) {
      expect(at({ p95Ms: p95, sequencing: true }).staleRate).toBe(0)
      // and it cancels nothing: the same requests are still dispatched
      expect(at({ p95Ms: p95, sequencing: true }).avgRequestsPerSession)
        .toBeCloseTo(at({ p95Ms: p95 }).avgRequestsPerSession, 5)
    }
  })

  it('claim:state-races-c6 — the same debounce fails an order of magnitude harder on a slow network', () => {
    const fast = at({ p95Ms: 480 }).staleRate
    const slow = at({ p95Ms: 1500 }).staleRate
    expect(fast).toBeCloseTo(0.013, 2)     // ~1%  — the number claims.ts states
    expect(slow).toBeCloseTo(0.128, 2)     // ~13% — the number claims.ts states
    expect(slow / fast).toBeGreaterThan(5) // "an order of magnitude more often"
  })

  it('the stated latency profile is the one the sim actually samples', () => {
    const m = at({})
    expect(m.medianLatency).toBeGreaterThan(100)
    expect(m.medianLatency).toBeLessThan(150)
    expect(m.p95Latency).toBeGreaterThan(400)
    expect(m.p95Latency).toBeLessThan(560)
  })

  it('is deterministic: same params and seed produce an identical timeline', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })

  it('honours the cognitive-load contract on every frame', () => {
    const tl = run()
    expect(tl.frames.length).toBeGreaterThan(0)
    expect(tl.ghost).toBeTruthy()          // a staged reveal needs a baseline
    for (const f of tl.frames) {
      expect(f.annotations.length).toBeLessThanOrEqual(7)
      expect(f.channels.length).toBeLessThanOrEqual(2)
      expect(f.narration.trim()).not.toBe('')
    }
  })

  it('every frame explains a claim that exists', () => {
    const ids = new Set(claims.map(c => c.id))
    for (const f of run().frames) expect(ids.has(f.explains)).toBe(true)
  })

  it('every measurement claim is covered by an assertion in this file', async () => {
    const { readFileSync } = await import('node:fs')
    const self = readFileSync(new URL(import.meta.url).pathname, 'utf8')
    for (const c of claims.filter(c => c.evidence === 'measurement')) {
      expect(self, `claim ${c.id} is evidence:'measurement' but nothing asserts it`).toContain(`claim:${c.id}`)
    }
  })
})
