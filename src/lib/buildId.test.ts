// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { shouldReload, clearReloadGuard, isChunkError, CURRENT_BUILD } from './buildId'

describe('stale-deploy recovery', () => {
  beforeEach(() => { clearReloadGuard() })

  it('permits exactly one reload, then refuses', () => {
    // The second refusal is the whole point: a chunk that is genuinely missing
    // would otherwise reload forever, and every iteration erases the evidence.
    expect(shouldReload()).toBe(true)
    expect(shouldReload()).toBe(false)
    expect(shouldReload()).toBe(false)
  })

  it('permits again once the guard is cleared', () => {
    expect(shouldReload()).toBe(true)
    clearReloadGuard()
    expect(shouldReload()).toBe(true)
  })

  it('recognises a failed dynamic import across browser wordings', () => {
    for (const msg of [
      'Failed to fetch dynamically imported module: /assets/m-x.js',
      'Importing a module script failed.',
      'error loading dynamically imported module',
      'ChunkLoadError: Loading chunk 3 failed.',
    ]) expect(isChunkError(new Error(msg))).toBe(true)
  })

  it('does not mistake an ordinary error for a stale deploy', () => {
    expect(isChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkError(new Error('QuotaExceededError'))).toBe(false)
  })

  it('always has a build id, even where define did not run', () => {
    expect(typeof CURRENT_BUILD).toBe('string')
    expect(CURRENT_BUILD.length).toBeGreaterThan(0)
  })
})
