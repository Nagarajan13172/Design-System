import { describe, it, expect } from 'vitest'
import { tokenize, resolveBlanks, lineDiff } from './shiki-plugin'

const SRC = `const controller = new AbortController()
fetch(url, { signal: controller.signal })
controller.abort()`

describe('build-time tokenizing (ADR-8)', () => {
  it('emits a deduped palette rather than a colour per token', async () => {
    const { lines, palette } = await tokenize(SRC, 'ts')
    const tokens = lines.flat()
    expect(tokens.length).toBeGreaterThan(20)
    // A handful of colour PAIRS stand in for every token: that is the payload win.
    expect(Object.keys(palette).length).toBeLessThan(10)
    for (const p of Object.values(palette)) {
      expect(p.light).toMatch(/^#/)
      expect(p.dark).toMatch(/^#/)
      expect(p.light).not.toBe(p.dark)   // both themes really are covered
    }
  })

  it('splits merged runs so individual identifiers are addressable', async () => {
    const { lines } = await tokenize(SRC, 'ts')
    // Shiki merges same-colour text; without the split, `signal` is buried inside
    // "(url, { signal: controller.signal })" and no blank could ever point at it.
    expect(lines[1]!.map(t => t.text)).toContain('signal')
  })

  it('preserves the source text exactly', async () => {
    const { lines } = await tokenize(SRC, 'ts')
    expect(lines.map(l => l.map(t => t.text).join('')).join('\n')).toBe(SRC)
  })
})

describe('cloze blanks', () => {
  it('resolves an unambiguous blank to a position', async () => {
    const { lines } = await tokenize(SRC, 'ts')
    const [b] = resolveBlanks({ id: 'b', lines }, [{ id: 'x', token: 'signal', occurrence: 1 }], 'f.ts')
    expect(b).toMatchObject({ id: 'x', blockId: 'b', line: 1, expected: 'signal' })
  })

  it('FAILS THE BUILD on an ambiguous blank, naming every line it appears on', async () => {
    const { lines } = await tokenize(SRC, 'ts')
    expect(() => resolveBlanks({ id: 'b', lines }, [{ id: 'y', token: 'controller' }], 'f.ts'))
      .toThrow(/AMBIGUOUS.*lines 1, 2, 3.*occurrence/s)
  })

  it('disambiguates by occurrence', async () => {
    const { lines } = await tokenize(SRC, 'ts')
    const first = resolveBlanks({ id: 'b', lines }, [{ id: 'y', token: 'controller', occurrence: 1 }], 'f.ts')[0]!
    const third = resolveBlanks({ id: 'b', lines }, [{ id: 'y', token: 'controller', occurrence: 3 }], 'f.ts')[0]!
    expect(first.line).toBe(0)
    expect(third.line).toBe(2)
  })

  it('fails on a blank that matches nothing, rather than rendering an empty input', async () => {
    const { lines } = await tokenize(SRC, 'ts')
    expect(() => resolveBlanks({ id: 'b', lines }, [{ id: 'z', token: 'nope' }], 'f.ts'))
      .toThrow(/matches no token/)
  })

  it('fails when the occurrence index is out of range', async () => {
    const { lines } = await tokenize(SRC, 'ts')
    expect(() => resolveBlanks({ id: 'b', lines }, [{ id: 'z', token: 'signal', occurrence: 9 }], 'f.ts'))
      .toThrow(/only 2 match/)
  })
})

describe('line diff', () => {
  it('reports changed lines on both sides', () => {
    expect(lineDiff(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual({ changedA: [1], changedB: [1] })
  })
  it('handles pure insertion and deletion', () => {
    expect(lineDiff(['a'], ['a', 'b'])).toEqual({ changedA: [], changedB: [1] })
    expect(lineDiff(['a', 'b'], ['a'])).toEqual({ changedA: [1], changedB: [] })
  })
  it('reports nothing for identical input', () => {
    expect(lineDiff(['a', 'b'], ['a', 'b'])).toEqual({ changedA: [], changedB: [] })
  })
})
