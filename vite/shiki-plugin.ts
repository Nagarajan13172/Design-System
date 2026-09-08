import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { codeToTokens, type ThemedToken } from 'shiki'

/**
 * ADR-8: SHIKI RUNS AT BUILD TIME. Zero highlighter bytes ship.
 *
 * `?code` imports a source file and returns a token stream plus resolved cloze
 * blank positions. One `cssVariables` token stream serves both themes, which halves
 * the payload versus emitting light and dark separately.
 *
 * A cloze blank is authored as TOKEN TEXT plus an optional occurrence index. If the
 * text matches more than once and no occurrence is given, THE BUILD FAILS naming the
 * file, the token and every line it appears on — an ambiguous blank that silently
 * picks the first match is a drill that grades the wrong thing.
 */
export interface CodeBlock {
  id: string
  label?: string
  lines: { text: string; cls: string }[][]
}

/** cls -> the light/dark colour pair it stands for. Emitted once per block. */
export type Palette = Record<string, { light: string; dark: string }>

const SUFFIX = '?code'

/**
 * Shiki 4 removed the `css-variables` theme, so we build the equivalent ourselves
 * and get something smaller: tokenize against BOTH themes, dedupe the distinct
 * (light, dark) colour PAIRS into a handful of class names, and emit the class.
 *
 * A real file has ~8 distinct pairs, so the token stream carries `cls: "c3"` rather
 * than two hex colours per token — roughly a third of the bytes, and both themes
 * come free because the palette is emitted once as CSS variables.
 */
export async function tokenize(source: string, lang: string): Promise<{ lines: CodeBlock['lines']; palette: Palette }> {
  const { tokens } = await codeToTokens(source, {
    lang: lang as never,
    // HIGH-CONTRAST variants, deliberately. The default github themes put keyword
    // red at ~4.5:1 on pure white, which drops below AA the moment a line sits on
    // any tint — measured with axe, not assumed.
    themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
    defaultColor: false,
  })

  const palette: Palette = {}
  const index = new Map<string, string>()
  const clsOf = (t: ThemedToken): string => {
    const style = (t.htmlStyle ?? {}) as Record<string, string>
    const light = style['--shiki-light'] ?? t.color ?? ''
    const dark = style['--shiki-dark'] ?? light
    if (!light) return ''
    const key = `${light}|${dark}`
    let cls = index.get(key)
    if (!cls) {
      cls = `c${index.size}`
      index.set(key, cls)
      palette[cls] = { light, dark }
    }
    return cls
  }

  // Shiki merges adjacent same-colour text into one token, so a whole expression
  // like `(url, { signal: controller.signal })` arrives as a single token and no
  // individual identifier is addressable. Splitting on word boundaries is what makes
  // a cloze blank resolvable to a position at all; the rendered text is unchanged.
  const lines = tokens.map(line =>
    line.flatMap(t => {
      const cls = clsOf(t)
      return (t.content.match(/[A-Za-z_$][\w$]*|\s+|[^\w\s$]+/g) ?? [t.content])
        .map(text => ({ text, cls }))
    }),
  )
  return { lines, palette }
}

export interface BlankSpec { id: string; token: string; occurrence?: number }

export interface ResolvedBlank { id: string; blockId: string; line: number; token: number; expected: string }

/**
 * Resolves authored blanks to (line, token) positions.
 * Throws — and therefore fails the build — on an ambiguous match.
 */
export function resolveBlanks(block: CodeBlock, specs: BlankSpec[], file: string): ResolvedBlank[] {
  const out: ResolvedBlank[] = []
  for (const spec of specs) {
    const hits: { line: number; token: number }[] = []
    block.lines.forEach((line, li) => {
      line.forEach((tok, ti) => {
        if (tok.text.trim() === spec.token) hits.push({ line: li, token: ti })
      })
    })
    if (hits.length === 0) {
      throw new Error(`${file}: cloze blank "${spec.token}" matches no token in block "${block.id}".`)
    }
    if (hits.length > 1 && spec.occurrence == null) {
      const lines = hits.map(h => h.line + 1).join(', ')
      throw new Error(
        `${file}: cloze blank "${spec.token}" is AMBIGUOUS in block "${block.id}" — it appears on lines ${lines}. ` +
        `Add \`occurrence: 1..${hits.length}\` to say which one. A blank that silently picks the first match grades the wrong thing.`,
      )
    }
    const hit = hits[(spec.occurrence ?? 1) - 1]
    if (!hit) {
      throw new Error(`${file}: cloze blank "${spec.token}" has occurrence ${spec.occurrence} but only ${hits.length} match(es) exist.`)
    }
    out.push({ id: spec.id, blockId: block.id, line: hit.line, token: hit.token, expected: spec.token })
  }
  return out
}

/** A minimal Myers-style line diff, build-time only, for `code-diff` drills. */
export function lineDiff(a: string[], b: string[]): { changedA: number[]; changedB: number[] } {
  const n = a.length, m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const changedA: number[] = [], changedB: number[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++ }
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) { changedA.push(i); i++ }
    else { changedB.push(j); j++ }
  }
  while (i < n) changedA.push(i++)
  while (j < m) changedB.push(j++)
  return { changedA, changedB }
}

export function shikiPlugin(): Plugin {
  return {
    name: 'fesd:shiki',
    async load(id) {
      if (!id.endsWith(SUFFIX)) return null
      const file = id.slice(0, -SUFFIX.length)
      const lang = file.split('.').pop() ?? 'ts'
      const { lines, palette } = await tokenize(readFileSync(file, 'utf8'), lang)
      return `export const lines = ${JSON.stringify(lines)}
export const palette = ${JSON.stringify(palette)}
export default { lines, palette }`
    },
  }
}
