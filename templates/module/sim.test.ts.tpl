import { describe, it, expect } from 'vitest'
import { run } from './sim'
import claims from './claims'

describe('__ID__ sim', () => {
  it.todo('claim:__ID__-c1 — assert the sim against what the claim states')

  it('honours the cognitive-load contract on every frame', () => {
    for (const f of run().frames) {
      expect(f.annotations.length).toBeLessThanOrEqual(7)
      expect(f.channels.length).toBeLessThanOrEqual(2)
      expect(f.narration.trim()).not.toBe('')
    }
  })

  it('is deterministic', () => expect(JSON.stringify(run())).toBe(JSON.stringify(run())))

  it('every frame explains a claim that exists', () => {
    const ids = new Set(claims.map(c => c.id))
    for (const f of run().frames) expect(ids.has(f.explains)).toBe(true)
  })
})
