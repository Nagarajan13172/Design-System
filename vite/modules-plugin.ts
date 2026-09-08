/**
 * The content pipeline's Vite half.
 *
 * Emits four virtual modules so that ADDING A MODULE EDITS ZERO FILES UNDER src/.
 * That property is the whole point: the app discovers content, content never
 * registers itself with the app.
 *
 *   virtual:manifest-lite   ~4kb gz  — id/domain/title/status/primitive for all 169.
 *                                      Ships in the landing chunk.
 *   virtual:manifest-full   lazy     — adds tier, verb, prereqs, related, oneLiner,
 *                                      figureSetup/Question, studyMinutes, authorHours.
 *   virtual:module-loader   lazy     — one dynamic import per built module, so each
 *                                      module is its own chunk.
 *   virtual:search-index    lazy     — the ⌘K corpus (no search library).
 */
import type { Plugin } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const IDS = {
  lite: 'virtual:manifest-lite',
  full: 'virtual:manifest-full',
  loader: 'virtual:module-loader',
  search: 'virtual:search-index',
  roadmap: 'virtual:roadmap-graph',
  cases: 'virtual:cases',
} as const

const resolved = (id: string) => '\0' + id

export function modulesPlugin(): Plugin {
  const load = async () => {
    // Imported fresh on each build/HMR pass so editing the curriculum invalidates.
    const url = new URL(`../content/_curriculum.ts?t=${Date.now()}`, import.meta.url).href
    const { CURRICULUM, DOMAINS } = (await import(url)) as typeof import('../content/_curriculum')
    return { CURRICULUM, DOMAINS }
  }

  const hasContent = (domain: string, id: string) =>
    existsSync(join(process.cwd(), 'content', domain, id, 'meta.ts'))

  /** Only LiveSurface modules ship a viz.tsx — a sim may not import React. */
  const hasViz = (domain: string, id: string) =>
    existsSync(join(process.cwd(), 'content', domain, id, 'viz.tsx'))

  /** Not every module has a trade-off worth defending; the ones that do ship defence.ts. */
  const hasDefence = (domain: string, id: string) =>
    existsSync(join(process.cwd(), 'content', domain, id, 'defence.ts'))

  /** Case studies ship case.ts: the prompt, the keys and the ladder's decision points. */
  const hasCase = (domain: string, id: string) =>
    existsSync(join(process.cwd(), 'content', domain, id, 'case.ts'))


  return {
    name: 'fesd:modules',
    enforce: 'pre',

    resolveId(id) {
      if (Object.values(IDS).includes(id as never)) return resolved(id)
      return null
    },

    async load(id) {
      if (!id.startsWith('\0virtual:')) return null
      const { CURRICULUM, DOMAINS } = await load()

      if (id === resolved(IDS.lite)) {
        const lite = CURRICULUM.map(m => ({
          id: m.id, domain: m.domain, title: m.title, status: m.status,
          primitive: m.primitive, level: m.level, tier: m.tier,
        }))
        return `export const MODULES = ${JSON.stringify(lite)}
export const DOMAINS = ${JSON.stringify(DOMAINS.map(d => ({ key: d.key, name: d.name, tier: d.tier })))}
export const BUILT = ${CURRICULUM.filter(m => m.status !== 'planned').length}
export const TOTAL = ${CURRICULUM.length}`
      }

      if (id === resolved(IDS.full)) {
        return `export const FULL = ${JSON.stringify(CURRICULUM)}
export const DOMAIN_META = ${JSON.stringify(DOMAINS)}`
      }

      if (id === resolved(IDS.loader)) {
        // One dynamic import per BUILT module => one chunk per module. Planned
        // modules are absent from the graph entirely, so they cost zero bytes.
        const built = CURRICULUM.filter(m => m.status !== 'planned' && hasContent(m.domain, m.id))
        // A virtual module has no directory context, so relative specifiers cannot
        // resolve. The @content alias is the stable way to point at a module dir.
        const entries = built.map(m => {
          const p = `@content/${m.domain}/${m.id}`
          return `  ${JSON.stringify(m.id)}: () => Promise.all([
    import(${JSON.stringify(p + '/meta')}),
    import(${JSON.stringify(p + '/claims')}),
    import(${JSON.stringify(p + '/items')}),
    import(${JSON.stringify(p + '/sim')}),
    import(${JSON.stringify(p + '/body.mdx')}),
    ${hasViz(m.domain, m.id) ? `import(${JSON.stringify(p + '/viz')})` : 'Promise.resolve({})'},
    ${hasDefence(m.domain, m.id) ? `import(${JSON.stringify(p + '/defence')})` : 'Promise.resolve({})'},
    ${hasCase(m.domain, m.id) ? `import(${JSON.stringify(p + '/case')})` : 'Promise.resolve({})'},
  ]).then(([meta, claims, items, sim, body, viz, defence, kase]) => ({
    meta: meta.default, claims: claims.default, items: items.default,
    sim, Body: body.default,
    // Only LiveSurface modules ship a viz.tsx: a sim may not import React
    // (SIM CONTRACT), so the real-DOM render function lives beside it.
    renderSurface: viz.renderSurface,
    defence: defence.default,
    caseSpec: kase.default,
  }))`
        })
        return `export const LOADERS = {\n${entries.join(',\n')}\n}
export const BUILT_IDS = ${JSON.stringify(built.map(m => m.id))}
export const loadModule = (id) => {
  const l = LOADERS[id]
  if (!l) return Promise.reject(new Error(\`module "\${id}" is not built (status: planned)\`))
  return l()
}`
      }

      if (id === resolved(IDS.cases)) {
        // Cases are their own content type: the independent partner of a ladder pair
        // ships as keys only and is deliberately NOT a built module.
        const withCase = CURRICULUM.filter(m => hasCase(m.domain, m.id))
        const entries = withCase.map(m =>
          `  ${JSON.stringify(m.id)}: () => import(${JSON.stringify(`@content/${m.domain}/${m.id}/case`)}).then(m => m.default)`)
        return `export const CASE_IDS = ${JSON.stringify(withCase.map(m => m.id))}
export const CASE_LOADERS = {\n${entries.join(',\n')}\n}
export const loadCase = (id) => {
  const l = CASE_LOADERS[id]
  if (!l) return Promise.reject(new Error(\`no case \${id}\`))
  return l()
}`
      }

      if (id === resolved(IDS.roadmap)) {
        const file = join(process.cwd(), 'content/_generated/roadmap-layout.json')
        if (!existsSync(file)) {
          this.error('content/_generated/roadmap-layout.json is missing. Run `pnpm build:layout`.')
        }
        const layout = JSON.parse(readFileSync(file, 'utf8')) as { edgeHash: string }

        // THE HASH CHECK. Editing a prereq without re-running the layout would ship
        // a map that silently disagrees with the curriculum, which is worse than no
        // map — so it fails the build instead.
        const current = createHash('sha256').update(JSON.stringify({
          nodes: CURRICULUM.map(m => m.id).sort(),
          edges: CURRICULUM.flatMap(m => m.prereqs.map(p => `${p}>${m.id}`)).sort(),
        })).digest('hex').slice(0, 16)

        if (current !== layout.edgeHash) {
          this.error(
            `roadmap layout is stale: the curriculum's edge set hashes to ${current} but ` +
            `content/_generated/roadmap-layout.json was built from ${layout.edgeHash}. ` +
            'Run `pnpm build:layout` and commit the result.',
          )
        }
        return `export const LAYOUT = ${JSON.stringify(layout)}`
      }

      if (id === resolved(IDS.search)) {
        // A hand-rolled inverted index. ~1,000 docs does not justify a search library.
        const docs = [
          ...CURRICULUM.map(m => ({
            id: m.id, t: m.title, d: m.domain, s: m.status, kind: 'module' as const,
            // The id is indexed too: typing `ui-stacking` is the most natural way
            // to search in a tool like this, and it found nothing until it was.
            text: `${m.id} ${m.title} ${m.oneLiner} ${m.figureQuestion}`.toLowerCase(),
          })),
          ...DOMAINS.map(d => ({
            id: d.key, t: d.name, d: d.key, s: 'domain', kind: 'domain' as const,
            text: `${d.key} ${d.name} ${d.summary}`.toLowerCase(),
          })),
        ].map((doc, i) => ({ ...doc, i }))
        // Stopwords and 3-letter tokens dominate the postings lists and carry almost
        // no discriminating power — dropping them roughly halved the index with no
        // measurable loss in result quality.
        const STOP = new Set(('the a an of to in on at for and or is are was were be been it its this that with as by from what which how why when does do did you your we our they their than then if not no more less most least first second into over under out up down can may must should would could each every both all any some such only same other another its it s'.split(' ')))
        const index: Record<string, number[]> = {}
        for (const doc of docs) {
          for (const tok of new Set(doc.text.match(/[a-z][a-z0-9-]{3,}/g) ?? [])) {
            if (STOP.has(tok)) continue
            (index[tok] ??= []).push(doc.i)
          }
        }
        return `export const DOCS = ${JSON.stringify(docs.map(({ i, id, t, d, s, kind }) => ({ i, id, t, d, s, kind })))}
export const INDEX = ${JSON.stringify(index)}`
      }
      return null
    },

    configureServer(server) {
      // Editing the curriculum invalidates every virtual module that reads it.
      server.watcher.add(join(process.cwd(), 'content'))
      server.watcher.on('change', file => {
        if (!file.includes('/content/')) return
        for (const vid of Object.values(IDS)) {
          const mod = server.moduleGraph.getModuleById(resolved(vid))
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}
