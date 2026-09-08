import { DOCS, INDEX } from 'virtual:search-index'

/**
 * Search, hand-rolled. ~1,000 documents does not justify Fuse or FlexSearch —
 * an inverted index built at build time plus this scoring function is the whole
 * feature, and it ships as data rather than as a library.
 */
export type Mode = 'module' | 'command' | 'domain' | 'route' | 'claim'

export interface Hit { id: string; title: string; sub: string; mode: Mode; score: number }

// Must match the index's tokenizer: 4+ characters, or a query term can never hit.
const tokens = (s: string) => s.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []

/**
 * Scoring, in order of how much each signal is worth:
 *   exact id match           1000
 *   id prefix                 500
 *   title word prefix         200
 *   per-term index hit         10
 *   built modules             +25 (you can actually open them)
 */
export function searchModules(query: string, limit = 12): Hit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = tokens(q)
  if (!terms.length) return []

  const scores = new Map<number, number>()
  for (const t of terms) {
    // Prefix expansion: typing "hydra" should find "hydration".
    for (const key of Object.keys(INDEX)) {
      if (!key.startsWith(t)) continue
      const weight = key === t ? 10 : 6
      for (const i of INDEX[key]!) scores.set(i, (scores.get(i) ?? 0) + weight)
    }
  }

  const hits: Hit[] = []
  for (const [i, base] of scores) {
    const doc = DOCS[i]
    if (!doc) continue
    let score = base
    if (doc.id === q) score += 1000
    else if (doc.id.startsWith(q)) score += 500
    if (tokens(doc.t).some(w => w.startsWith(terms[0]!))) score += 200
    if (doc.kind === 'module' && doc.s !== 'planned') score += 25

    hits.push({
      id: doc.id,
      title: doc.t,
      sub: doc.kind === 'domain' ? 'domain' : `${doc.d} · ${doc.s === 'planned' ? 'specified' : doc.s}`,
      mode: doc.kind === 'domain' ? 'domain' : 'module',
      score,
    })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

export const COMMANDS: Hit[] = [
  { id: '/review', title: 'Go to review', sub: 'the daily queue', mode: 'command', score: 0 },
  { id: '/roadmap', title: 'Go to roadmap', sub: 'the whole curriculum', mode: 'command', score: 0 },
  { id: '/progress', title: 'Go to progress', sub: 'coverage, mastery, confidence', mode: 'command', score: 0 },
  { id: '/start', title: 'Replay the cold open', sub: 'the first ten minutes', mode: 'command', score: 0 },
  { id: 'theme', title: 'Toggle theme', sub: 'light / dark', mode: 'command', score: 0 },
]

export const ROUTES: Hit[] = [
  { id: '/review', title: '/review', sub: 'landing', mode: 'route', score: 0 },
  { id: '/roadmap', title: '/roadmap', sub: 'list and map', mode: 'route', score: 0 },
  { id: '/progress', title: '/progress', sub: 'three axes', mode: 'route', score: 0 },
  { id: '/practice', title: '/practice', sub: 'reserved', mode: 'route', score: 0 },
  { id: '/dev', title: '/dev', sub: 'authoring', mode: 'route', score: 0 },
]

/** `>` commands · `@` domains · `/` routes · `#` claims · anything else, modules. */
export function parse(input: string): { mode: Mode; query: string } {
  const c = input[0]
  if (c === '>') return { mode: 'command', query: input.slice(1).trim() }
  if (c === '@') return { mode: 'domain', query: input.slice(1).trim() }
  if (c === '#') return { mode: 'claim', query: input.slice(1).trim() }
  if (c === '/') return { mode: 'route', query: input.trim() }
  return { mode: 'module', query: input.trim() }
}

const filter = (list: Hit[], q: string) =>
  !q ? list : list.filter(h => (h.title + h.id + h.sub).toLowerCase().includes(q.toLowerCase()))

export function run(input: string): { mode: Mode; hits: Hit[] } {
  const { mode, query } = parse(input)
  if (mode === 'command') return { mode, hits: filter(COMMANDS, query) }
  if (mode === 'route') return { mode, hits: filter(ROUTES, query) }
  if (mode === 'domain') {
    return { mode, hits: (query ? searchModules(query, 20) : DOCS.filter(d => d.kind === 'domain').map(d => ({
      id: d.id, title: d.t, sub: 'domain', mode: 'domain' as const, score: 0,
    }))).filter(h => h.mode === 'domain' || !query) }
  }
  return { mode, hits: searchModules(query) }
}
