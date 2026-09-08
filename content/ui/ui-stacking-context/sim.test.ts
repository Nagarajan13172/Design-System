import { describe, it, expect } from 'vitest'
import { resolve, createsContext, run, DEFAULTS } from './sim'
import claims from './claims'

describe('ui-stacking-context sim', () => {
  it('claim:ui-stacking-context-c3 — a translateZ(0) traps the modal below the header', () => {
    const withT = resolve({ ...DEFAULTS, cardHasTransform: true })
    expect(withT.modalContext).toBe('card')
    expect(withT.aboveHeader).toBe(false)

    // The flip condition, asserted: remove the transform and the order is restored.
    const without = resolve({ ...DEFAULTS, cardHasTransform: false })
    expect(without.modalContext).toBe('root')
    expect(without.aboveHeader).toBe(true)
  })

  it('claim:ui-stacking-context-c4 — the same property also captures position: fixed', () => {
    expect(resolve({ ...DEFAULTS, cardHasTransform: true }).fixedToViewport).toBe(false)
    expect(resolve({ ...DEFAULTS, cardHasTransform: false }).fixedToViewport).toBe(true)
  })

  it('creates a context from transform alone, with no z-index and no positioning', () => {
    expect(createsContext({ id: 'x', label: 'x', parent: 'root', transform: true })).toBe(true)
    expect(createsContext({ id: 'x', label: 'x', parent: 'root', opacity: 0.99 })).toBe(true)
    expect(createsContext({ id: 'x', label: 'x', parent: 'root', position: 'relative' })).toBe(false)
    // A z-index only counts on a positioned element.
    expect(createsContext({ id: 'x', label: 'x', parent: 'root', zIndex: 5 })).toBe(false)
    expect(createsContext({ id: 'x', label: 'x', parent: 'root', zIndex: 5, position: 'relative' })).toBe(true)
  })

  it('the top layer escapes the tree entirely', () => {
    const top = resolve({ ...DEFAULTS, useTopLayer: true })
    expect(top.aboveHeader).toBe(true)
    expect(top.fixedToViewport).toBe(true)
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

  it('every measurement claim is covered by an assertion in this file', async () => {
    const { readFileSync } = await import('node:fs')
    const self = readFileSync(new URL(import.meta.url).pathname, 'utf8')
    for (const c of claims.filter(c => c.evidence === 'measurement')) {
      expect(self).toContain(`claim:${c.id}`)
    }
  })
})
