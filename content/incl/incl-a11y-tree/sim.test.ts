import { describe, it, expect } from 'vitest'
import { accessibleName, iconButtonName, run, DEFAULTS } from './sim'
import claims from './claims'

describe('incl-a11y-tree sim', () => {
  it('claim:incl-a11y-tree-c2 — aria-hidden on the only text leaves the control unnamed', () => {
    expect(iconButtonName({ ...DEFAULTS, hideIconText: true }).name).toBe('')
    expect(iconButtonName({ ...DEFAULTS, hideIconText: false }).name).toBe('Submit')
  })

  it('claim:incl-a11y-tree-c3 — placeholder is the LAST resort, below every real label', () => {
    // aria-label and <label for> both win over a placeholder...
    expect(accessibleName({ ...DEFAULTS, useAriaLabel: true }).from).toBe('aria-label')
    expect(accessibleName({ ...DEFAULTS, useVisibleLabel: true }).from).toBe('<label for>')
    // ...and with nothing else, the placeholder is all that is left.
    expect(accessibleName(DEFAULTS).from).toContain('last resort')
    // Remove it and the control has no name at all.
    expect(accessibleName({ ...DEFAULTS, usePlaceholder: false }).name).toBe('')
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

  it('emits prop states and selectors rather than geometry — the LiveSurface contract', () => {
    for (const f of run().frames) {
      const s = f.state
      expect(s.props).toBeTruthy()
      for (const o of s.overlays) {
        expect(typeof o.selector).toBe('string')
        // No coordinates: they do not exist until after layout.
        expect(o).not.toHaveProperty('x')
      }
    }
  })

  it('every measurement claim is covered by an assertion in this file', async () => {
    const { readFileSync } = await import('node:fs')
    const self = readFileSync(new URL(import.meta.url).pathname, 'utf8')
    for (const c of claims.filter(c => c.evidence === 'measurement')) expect(self).toContain(`claim:${c.id}`)
  })
})
