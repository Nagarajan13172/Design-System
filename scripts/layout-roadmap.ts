/**
 * `pnpm build:layout` — computes the roadmap's coordinates ONCE, at build time.
 *
 * ADR-6: no graph library and no runtime layout. elkjs is ~500kb and dagre ~100kb to
 * compute a layout that is identical on every deploy, so it runs here and the result
 * is committed.
 *
 * Layered ordering by prereq depth inside hand-authored domain cluster boxes, then a
 * barycenter sweep to reduce crossings. ~200 lines, which is the whole argument.
 *
 * The output carries an EDGE-SET HASH. The build verifies it against the current
 * curriculum, so editing a prereq without re-running this fails loudly instead of
 * shipping a map that quietly disagrees with the data.
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { CURRICULUM, DOMAINS } from '../content/_curriculum'
import type { DomainKey, LayoutNode, LayoutBox, LayoutEdge, RoadmapLayout } from '../content/types'

/** Hand-authored cluster grid: the spine. Ordered so prerequisites flow left-to-right. */
const CLUSTER_GRID: DomainKey[][] = [
  ['found', 'arch', 'state', 'api'],
  ['perf', 'ui', 'ds', 'incl'],
  ['rt', 'sec', 'ops', 'ai'],
  ['cs', 'meta'],
]

const NODE_W = 132
const NODE_H = 26
const NODE_GAP_X = 22
const NODE_GAP_Y = 12
const BOX_PAD = 30
const BOX_GAP = 44



/** The hash the build checks. Any change to nodes or hard prereqs invalidates it. */
export function edgeSetHash(): string {
  const nodes = CURRICULUM.map(m => m.id).sort()
  const edges = CURRICULUM.flatMap(m => m.prereqs.map(p => `${p}>${m.id}`)).sort()
  return createHash('sha256').update(JSON.stringify({ nodes, edges })).digest('hex').slice(0, 16)
}

/** Longest prereq chain within the domain: the layer an entry belongs on. */
function depthWithinDomain(domain: DomainKey): Map<string, number> {
  const inDomain = CURRICULUM.filter(m => m.domain === domain)
  const ids = new Set(inDomain.map(m => m.id))
  const depth = new Map<string, number>()
  const visiting = new Set<string>()

  const walk = (id: string): number => {
    const cached = depth.get(id)
    if (cached != null) return cached
    if (visiting.has(id)) return 0            // lint guarantees acyclic; be safe anyway
    visiting.add(id)
    const m = CURRICULUM.find(x => x.id === id)!
    const local = m.prereqs.filter(p => ids.has(p))
    const d = local.length ? Math.max(...local.map(walk)) + 1 : 0
    visiting.delete(id)
    depth.set(id, d)
    return d
  }
  for (const m of inDomain) walk(m.id)
  return depth
}

/**
 * Barycenter sweep: order each layer by the mean position of the nodes it connects
 * to on the previous layer. Two passes is enough at this size and is the standard
 * cheap crossing-reduction heuristic.
 */
function orderLayers(layers: string[][], edgesInto: Map<string, string[]>): string[][] {
  const out = layers.map(l => [...l])
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < out.length; i++) {
      const prevIndex = new Map(out[i - 1]!.map((id, idx) => [id, idx]))
      out[i]!.sort((a, b) => bary(a) - bary(b))
      function bary(id: string) {
        const parents = (edgesInto.get(id) ?? []).map(p => prevIndex.get(p)).filter((n): n is number => n != null)
        return parents.length ? parents.reduce((s, v) => s + v, 0) / parents.length : Number.MAX_SAFE_INTEGER
      }
    }
  }
  return out
}

export function computeLayout(): RoadmapLayout {
  const nodes: LayoutNode[] = []
  const boxes: LayoutBox[] = []
  const edgesInto = new Map<string, string[]>()
  for (const m of CURRICULUM) {
    for (const p of m.prereqs) {
      if (!edgesInto.has(m.id)) edgesInto.set(m.id, [])
      edgesInto.get(m.id)!.push(p)
    }
  }

  let cursorY = BOX_GAP
  let maxX = 0

  for (const row of CLUSTER_GRID) {
    let cursorX = BOX_GAP
    let rowHeight = 0

    for (const domain of row) {
      const meta = DOMAINS.find(d => d.key === domain)
      if (!meta) continue
      const depth = depthWithinDomain(domain)
      const maxDepth = Math.max(0, ...depth.values())

      const layers: string[][] = Array.from({ length: maxDepth + 1 }, () => [])
      for (const m of CURRICULUM.filter(m => m.domain === domain)) {
        layers[depth.get(m.id) ?? 0]!.push(m.id)
      }
      const ordered = orderLayers(layers, edgesInto)

      const cols = ordered.length
      const rows = Math.max(...ordered.map(l => l.length), 1)
      const boxW = cols * NODE_W + (cols - 1) * NODE_GAP_X + BOX_PAD * 2
      const boxH = rows * NODE_H + (rows - 1) * NODE_GAP_Y + BOX_PAD * 2 + 14

      boxes.push({ domain, name: meta.name, x: cursorX, y: cursorY, w: boxW, h: boxH })

      ordered.forEach((layer, li) => {
        layer.forEach((id, ri) => {
          nodes.push({
            id, domain,
            x: cursorX + BOX_PAD + li * (NODE_W + NODE_GAP_X),
            y: cursorY + BOX_PAD + 14 + ri * (NODE_H + NODE_GAP_Y),
            w: NODE_W, h: NODE_H,
          })
        })
      })

      cursorX += boxW + BOX_GAP
      rowHeight = Math.max(rowHeight, boxH)
      maxX = Math.max(maxX, cursorX)
    }
    cursorY += rowHeight + BOX_GAP
  }

  const byId = new Map(nodes.map(n => [n.id, n]))
  const edges: LayoutEdge[] = []
  for (const m of CURRICULUM) {
    for (const p of m.prereqs) {
      const a = byId.get(p), b = byId.get(m.id)
      if (!a || !b) continue
      const cross = a.domain !== b.domain
      const from: [number, number] = [a.x + a.w, a.y + a.h / 2]
      const to: [number, number] = [b.x, b.y + b.h / 2]
      // Cross-domain edges route BELOW the cluster boxes rather than through them,
      // so an edge never reads as if it belonged to a domain it merely passes over.
      const points: [number, number][] = cross
        ? [from, [from[0] + 14, from[1]], [from[0] + 14, cursorY - BOX_GAP / 2], [to[0] - 14, cursorY - BOX_GAP / 2], [to[0] - 14, to[1]], to]
        : [from, [(from[0] + to[0]) / 2, from[1]], [(from[0] + to[0]) / 2, to[1]], to]
      edges.push({ id: `${p}>${m.id}`, from: p, to: m.id, cross, points })
    }
  }

  return { edgeHash: edgeSetHash(), width: maxX + BOX_GAP, height: cursorY, nodes, boxes, edges }
}

const layout = computeLayout()
writeFileSync('content/_generated/roadmap-layout.json', JSON.stringify(layout))
const crossings = layout.edges.filter(e => e.cross).length
console.log(`${layout.nodes.length} nodes in ${layout.boxes.length} clusters, ${layout.edges.length} edges (${crossings} cross-domain)`)
console.log(`canvas ${layout.width} x ${layout.height}`)
console.log(`edgeHash ${layout.edgeHash} -> content/_generated/roadmap-layout.json`)

export type { RoadmapLayout, LayoutNode, LayoutBox, LayoutEdge }
