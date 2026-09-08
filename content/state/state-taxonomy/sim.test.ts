import { describe, it, expect } from 'vitest'
import { failuresFor, run } from './sim'
import claims from './claims'

describe('state-taxonomy sim', () => {
  it('claim:state-taxonomy-c2 — a client store fixes the failures that were not happening', () => {
    const component = failuresFor('component')
    const store = failuresFor('client-store')
    expect(component).toContain('disagreement')
    expect(component).toContain('lostOnRemount')
    expect(store).not.toContain('disagreement')
    expect(store).not.toContain('lostOnRemount')
    // ...and leaves the one that actually fires.
    expect(store).toContain('staleAfterExternalChange')
  })

  it('claim:state-taxonomy-c3 — the URL survives reload and shares, but never revalidates', () => {
    const url = failuresFor('url')
    expect(url).not.toContain('notShareable')
    expect(url).not.toContain('lostOnRemount')
    expect(url).toContain('staleAfterExternalChange')
  })

  it('claim:state-taxonomy-c4 — only a cache with a freshness policy closes staleness', () => {
    const placements = ['component', 'client-store', 'url', 'server-cache'] as const
    const closed = placements.filter(p => !failuresFor(p).includes('staleAfterExternalChange'))
    expect(closed).toEqual(['server-cache'])
  })

  it('an authored-heuristic claim is never asserted by a sim frame', () => {
    const heuristics = claims.filter(c => c.evidence === 'authored-heuristic')
    expect(heuristics.length).toBeGreaterThan(0)
    for (const c of heuristics) expect(run().frames.some(f => f.explains === c.id)).toBe(false)
  })

  it('is deterministic and honours the cognitive-load contract', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
    const tl = run()
    expect(tl.ghost).toBeTruthy()
    for (const f of tl.frames) {
      expect(f.annotations.length).toBeLessThanOrEqual(7)
      expect(f.channels.length).toBeLessThanOrEqual(2)
    }
  })

  it('every measurement claim is covered by an assertion in this file', async () => {
    const { readFileSync } = await import('node:fs')
    const self = readFileSync(new URL(import.meta.url).pathname, 'utf8')
    for (const c of claims.filter(c => c.evidence === 'measurement')) {
      expect(self, `claim ${c.id} is evidence:'measurement' but nothing asserts it`).toContain(`claim:${c.id}`)
    }
  })
})
