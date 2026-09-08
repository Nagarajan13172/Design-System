import { describe, it, expect } from 'vitest'
import { cell, run } from './sim'
import claims from './claims'

describe('arch-hydration ledger', () => {
  it('claim:arch-hydration-c2 — SSR is the only strategy that makes TTFB worse', () => {
    const worse = (['csr', 'ssg', 'ssr', 'streaming', 'islands'] as const).filter(s => cell(s, 'ttfb') === 'fail')
    expect(worse).toEqual(['ssr'])
    // And it buys content in the HTML with it — that is the trade, not a mistake.
    expect(cell('ssr', 'firstPaint')).toBe('pass')
    expect(cell('csr', 'firstPaint')).toBe('fail')
  })

  it('claim:arch-hydration-c3 — streaming recovers TTFB but not interactivity', () => {
    expect(cell('streaming', 'ttfb')).toBe('pass')
    expect(cell('streaming', 'firstPaint')).toBe('pass')
    // Still 'partial': the same hydration work remains.
    expect(cell('streaming', 'interactive')).toBe('partial')
    expect(cell('ssr', 'interactive')).toBe('partial')
  })

  it('claim:arch-hydration-c4 — islands are the only row that clears the interactive column', () => {
    const clear = (['csr', 'ssg', 'ssr', 'streaming', 'islands'] as const).filter(s => cell(s, 'interactive') === 'pass')
    expect(clear).toEqual(['islands'])
  })

  it('no strategy passes every column — the ledger has no free lunch row', () => {
    for (const s of ['csr', 'ssg', 'ssr', 'streaming', 'islands'] as const) {
      const axes = ['ttfb', 'firstPaint', 'interactive', 'personalised', 'infra'] as const
      expect(axes.some(a => cell(s, a) !== 'pass'), `${s} passes everything`).toBe(true)
    }
  })

  it('an authored-heuristic claim is never asserted by a sim frame', () => {
    const heuristics = claims.filter(c => c.evidence === 'authored-heuristic')
    expect(heuristics.length).toBeGreaterThan(0)
    for (const c of heuristics) expect(run().frames.some(f => f.explains === c.id)).toBe(false)
  })

  it('is deterministic and honours the cognitive-load contract', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
    for (const f of run().frames) {
      expect(f.annotations.length).toBeLessThanOrEqual(7)
      expect(f.channels.length).toBeLessThanOrEqual(2)
    }
  })

  it('every measurement claim is covered by an assertion in this file', async () => {
    const { readFileSync } = await import('node:fs')
    const self = readFileSync(new URL(import.meta.url).pathname, 'utf8')
    for (const c of claims.filter(c => c.evidence === 'measurement')) expect(self).toContain(`claim:${c.id}`)
  })
})
