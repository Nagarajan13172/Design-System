import { useState } from 'react'
import { NodeGraph } from '@/primitives/NodeGraph'
import type { NodeGraphState } from '@content/types'
import { canConnect, gradeGraph, type CanvasKey, type Graph, type GradeBreakdown } from '@/domain/grading/graph'

/**
 * THE ARCHITECTURE CANVAS — a fixed typed-port palette, not a drawing surface.
 *
 * A freehand canvas produces an artifact nothing can grade, and practice without
 * feedback does not build skill. Constraining the palette is what makes the output a
 * GRAPH, and the typed ports mean an incompatible connection is physically refused
 * rather than silently marked wrong afterwards.
 *
 * Fully keyboard-driven: number keys place from the palette, and connections are
 * made by picking a source port then a destination. No drag library (cut list).
 */
export function Canvas({ canvasKey, onGrade }: { canvasKey: CanvasKey; onGrade?: (g: GradeBreakdown) => void }) {
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] })
  const [sel, setSel] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<{ node: string; port: string } | null>(null)
  const [result, setResult] = useState<GradeBreakdown | null>(null)
  const [refused, setRefused] = useState<string | null>(null)

  const place = (type: string) => {
    const def = canvasKey.palette.find(p => p.type === type)!
    const existing = graph.nodes.filter(n => n.type === type).length
    if (def.max != null && existing >= def.max) { setRefused(`Only ${def.max} ${def.label} allowed.`); return }
    const id = `${type}-${existing + 1}`
    setGraph(g => ({ ...g, nodes: [...g.nodes, { id, type }] }))
    setSel(id)
    setRefused(null)
  }

  const connect = (toNode: string, toPort: string) => {
    if (!connectFrom) return
    const from = graph.nodes.find(n => n.id === connectFrom.node)!
    const to = graph.nodes.find(n => n.id === toNode)!
    if (!canConnect(canvasKey, from, connectFrom.port, to, toPort)) {
      // REFUSED, not marked wrong later. The port types are the teaching.
      setRefused(`${from.type}.${connectFrom.port} cannot connect to ${to.type}.${toPort} — the port types differ.`)
      setConnectFrom(null)
      return
    }
    setGraph(g => ({
      ...g,
      edges: [...g.edges, {
        id: `${connectFrom.node}:${connectFrom.port}->${toNode}:${toPort}`,
        from: connectFrom.node, fromPort: connectFrom.port, to: toNode, toPort,
      }],
    }))
    setConnectFrom(null)
    setRefused(null)
  }

  const submit = () => {
    const g = gradeGraph(graph, canvasKey)
    setResult(g)
    onGrade?.(g)
  }

  const state: NodeGraphState = {
    nodes: graph.nodes.map((n, i) => ({
      id: n.id, label: canvasKey.palette.find(p => p.type === n.type)?.label ?? n.type,
      x: 20 + (i % 4) * 150, y: 20 + Math.floor(i / 4) * 70, w: 130, h: 34,
    })),
    edges: graph.edges.map(e => ({ id: e.id, from: e.from, to: e.to, kind: 'data' as const })),
    nodeState: Object.fromEntries(graph.nodes.map(n => [
      n.id, n.id === sel ? 'active' : connectFrom?.node === n.id ? 'flagged' : 'idle',
    ])) as NodeGraphState['nodeState'],
  }

  return (
    <div>
      <div className="rounded border mb-3" style={{ borderColor: 'var(--border)', background: 'var(--raised)', minHeight: 160 }}>
        <NodeGraph state={graph.nodes.length ? state : null} annotations={[]} />
      </div>

      <fieldset className="mb-3">
        <legend className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
          palette — press a number to place
        </legend>
        <div className="flex gap-1.5 flex-wrap">
          {canvasKey.palette.map((p, i) => (
            <button key={p.type} onClick={() => place(p.type)}
                    onKeyDown={e => {
                      const n = Number(e.key)
                      if (n >= 1 && n <= canvasKey.palette.length) { e.preventDefault(); place(canvasKey.palette[n - 1]!.type) }
                    }}
                    className="px-2.5 py-1.5 rounded border text-[13px] flex items-center gap-1.5"
                    style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              <kbd className="font-mono text-[10px]" style={{ color: 'var(--text-faint)' }}>{i + 1}</kbd>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      {graph.nodes.length > 0 && (
        <fieldset className="mb-3">
          <legend className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-faint)' }}>
            {connectFrom ? 'now pick a destination port' : 'pick a source port to connect from'}
          </legend>
          <div className="flex gap-1.5 flex-wrap">
            {graph.nodes.flatMap(n => {
              const def = canvasKey.palette.find(p => p.type === n.type)!
              return def.ports
                .filter(port => (connectFrom ? port.dir === 'in' : port.dir === 'out'))
                .map(port => (
                  <button key={`${n.id}.${port.id}`}
                          onClick={() => { if (connectFrom) connect(n.id, port.id); else setConnectFrom({ node: n.id, port: port.id }) }}
                          className="px-2 py-1 rounded border font-mono text-[11px]"
                          style={{ borderColor: 'var(--border-strong)', background: 'var(--raised)', color: 'var(--text-dim)' }}>
                    {n.id}.{port.id} <span style={{ color: 'var(--text-faint)' }}>({port.type})</span>
                  </button>
                ))
            })}
          </div>
        </fieldset>
      )}

      {refused && <p className="mb-3 text-[13px]" style={{ color: 'var(--d-blocked-text)' }}>{refused}</p>}

      <button onClick={submit} className="px-3 py-1.5 rounded" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        Check the design
      </button>

      {result && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <p style={{ color: result.passed ? 'var(--d-work-text)' : 'var(--text)' }}>
            {result.passed ? 'That holds together.' : `${Math.round(result.score * 100)}% — not yet.`}
          </p>
          {result.zeroedBecause && <p className="mt-1" style={{ color: 'var(--d-error-text)' }}>{result.zeroedBecause}</p>}
          {result.edges.missing.length > 0 && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
              Missing: {result.edges.missing.map(([a, b]) => `${a} → ${b}`).join(', ')}
            </p>
          )}
          {result.forbidden.length > 0 && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--d-error-text)' }}>
              Should not exist: {result.forbidden.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
