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
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const IDS = {
  lite: 'virtual:manifest-lite',
  full: 'virtual:manifest-full',
  loader: 'virtual:module-loader',
  search: 'virtual:search-index',
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
  ]).then(([meta, claims, items, sim, body]) => ({
    meta: meta.default, claims: claims.default, items: items.default,
    sim, Body: body.default,
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

      if (id === resolved(IDS.search)) {
        // A hand-rolled inverted index. ~1,000 docs does not justify a search library.
        const docs = CURRICULUM.map((m, i) => ({
          i, id: m.id, t: m.title, d: m.domain, s: m.status,
          text: `${m.title} ${m.oneLiner} ${m.figureQuestion}`.toLowerCase(),
        }))
        const index: Record<string, number[]> = {}
        for (const doc of docs) {
          for (const tok of new Set(doc.text.match(/[a-z][a-z0-9-]{2,}/g) ?? [])) {
            (index[tok] ??= []).push(doc.i)
          }
        }
        return `export const DOCS = ${JSON.stringify(docs.map(({ i, id, t, d, s }) => ({ i, id, t, d, s })))}
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
