import { describe, it, expect } from 'vitest'
import { schedule, run, DEFAULTS } from './sim'
import claims from './claims'

describe('found-event-loop sim', () => {
  it('claim:found-event-loop-c3 — a 0ms timer usually beats rAF, and the order flips at the frame boundary', () => {
    // The counterintuitive default: A before C.
    expect(schedule({ ...DEFAULTS, timerDelayMs: 0 }).order).toEqual(['D', 'B', 'A', 'C'])
    // Still A first anywhere inside the frame...
    for (const d of [0, 5, 10, 16]) expect(schedule({ ...DEFAULTS, timerDelayMs: d }).order).toEqual(['D', 'B', 'A', 'C'])
    // ...and C first once the delay exceeds the time to the next frame.
    for (const d of [20, 30, 50]) expect(schedule({ ...DEFAULTS, timerDelayMs: d }).order).toEqual(['D', 'B', 'C', 'A'])
  })

  it('claim:found-event-loop-c4 — one frame produces exactly one paint', () => {
    for (const d of [0, 10, 25]) expect(schedule({ ...DEFAULTS, timerDelayMs: d }).paints).toBe(1)
  })

  it('claim:found-event-loop-c5 — an unbounded microtask chain starves rendering entirely', () => {
    const starved = schedule({ ...DEFAULTS, microtaskChain: 5000 })
    expect(starved.starved).toBe(true)
    expect(starved.paints).toBe(0)
    expect(starved.order).not.toContain('C')   // rAF never runs
    expect(starved.order).not.toContain('A')   // and neither does the timer
  })

  it('D and B always precede both A and C, whatever the timing', () => {
    for (const d of [0, 8, 17, 40]) {
      const o = schedule({ ...DEFAULTS, timerDelayMs: d }).order
      expect(o[0]).toBe('D')
      expect(o[1]).toBe('B')
    }
  })

  it('is deterministic and honours the cognitive-load contract', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
    const tl = run()
    expect(tl.ghost).toBeTruthy()
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
