import { describe, it, expect } from 'vitest'
import { measure, run, DEFAULTS } from './sim'
import claims from './claims'

describe('perf-field-vs-lab sim', () => {
  it('claim:perf-field-vs-lab-c1 — the lab point sits far below the field distribution', () => {
    const m = measure()
    expect(DEFAULTS.labMs).toBeLessThan(m.medianBefore)
    expect(DEFAULTS.labMs).toBeLessThan(m.p75Before)
    // The spread is the point: a single number cannot stand in for this.
    expect(m.p95Before / m.medianBefore).toBeGreaterThan(2)
  })

  it('claim:perf-field-vs-lab-c2 — median moves 700ms and p75 moves exactly zero', () => {
    const m = measure()
    expect(m.medianBefore - m.medianAfter).toBeCloseTo(DEFAULTS.fixSavingMs, -1)
    expect(m.p75Before - m.p75After).toBe(0)
    expect(m.p95Before - m.p95After).toBe(0)
    // And it genuinely helped a majority of sessions — that is what makes it a trap.
    expect(m.helped).toBeGreaterThan(0.5)
  })

  it('a fix that reaches the tail DOES move p75 — the flip condition holds', () => {
    const tailFix = measure({ ...DEFAULTS, fixHelpsBelowMs: 99_999, fixSavingMs: 700 })
    expect(tailFix.p75Before - tailFix.p75After).toBeGreaterThan(400)
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
