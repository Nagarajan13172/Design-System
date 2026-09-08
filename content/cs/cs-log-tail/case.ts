import type { CaseSpec } from '../../types'

/**
 * THE INDEPENDENT RUNG.
 *
 * Structurally the same problem as cs-autocomplete — an unbounded stream rendered
 * into a bounded surface, with a guard on the edge — and a completely different
 * surface. Running the independent stage on the case you were walked through
 * measures recall of the walkthrough, which is why the pairing lint compares
 * structure tags and the semantic key rather than palette labels.
 */
const spec: CaseSpec = {
  id: 'cs-log-tail',
  moduleId: 'cs-log-tail',
  prompt:
    'Design a live log tail for a deploy dashboard. Lines stream in continuously, engineers scroll ' +
    'back to read while it is still streaming, and the page must stay responsive. Walk me through it.',

  requirements: [
    { id: 'r1', text: 'New lines appear without a refresh', blastRadius: 'none' },
    { id: 'r2', text: 'Scrolling back must not be yanked away by new output', blastRadius: 'high' },
    { id: 'r3', text: 'Survives 500 lines per second without dropping frames', blastRadius: 'high' },
    { id: 'r4', text: 'Lines are colour-coded by level', blastRadius: 'none' },
    { id: 'r5', text: 'A reconnect must not duplicate or lose lines', blastRadius: 'some' },
  ],

  decisionPoints: [],   // the independent rung shows none by design

  ledger: [
    {
      id: 'l1', decision: 'Render volume', chose: 'Virtualised window with batched appends',
      rejected: 'Appending every line to the DOM',
      flipsWhen: 'Throughput drops low enough that the window costs more than it saves.',
    },
    {
      id: 'l2', decision: 'Scroll ownership', chose: 'Follow-the-tail only while pinned to the bottom',
      rejected: 'Always scrolling to the newest line',
      flipsWhen: 'The surface is not readable mid-stream — a progress meter rather than a log.',
    },
  ],

  subsystems: [
    { id: 's1', label: 'The append guard', focus: 'A batch of lines arrives while the user is scrolled up. What reaches the DOM, and what happens to the scroll position?' },
    { id: 's2', label: 'The reconnect', focus: 'The socket drops for four seconds. How does the tail resume without duplicating or losing lines?' },
  ],

  structureTags: ['unbounded-stream', 'bounded-surface', 'edge-guard', 'ordering', 'backpressure'],
  independentPartner: 'cs-autocomplete',

  /**
   * Structurally the same shape as cs-autocomplete's key — a source, a policy, a
   * guard on the edge, a bounded surface — and a completely different palette, which
   * is what the pairing lint checks.
   */
  canvasKey: {
    palette: [
      { type: 'socket', label: 'log socket', max: 1, ports: [{ id: 'lines', type: 'stream', dir: 'out' }] },
      { type: 'batcher', label: 'frame batcher', max: 1, ports: [{ id: 'in', type: 'stream', dir: 'in' }, { id: 'out', type: 'stream', dir: 'out' }] },
      { type: 'buffer', label: 'ring buffer', ports: [{ id: 'in', type: 'stream', dir: 'in' }, { id: 'out', type: 'rows', dir: 'out' }] },
      { type: 'anchor', label: 'scroll anchor', ports: [{ id: 'in', type: 'rows', dir: 'in' }, { id: 'out', type: 'rows', dir: 'out' }] },
      { type: 'window', label: 'virtualised window', max: 1, ports: [{ id: 'rows', type: 'rows', dir: 'in' }] },
      { type: 'dom', label: 'raw DOM append', ports: [{ id: 'in', type: 'stream', dir: 'in' }] },
    ],
    requiredNodes: ['socket', 'batcher', 'window'],
    requiredEdges: [['socket', 'batcher'], ['buffer', 'anchor']],
    forbiddenEdges: [['socket', 'dom']],
    invariants: [{
      id: 'anchored',
      label: 'nothing stands between new rows and the viewport',
      critical: true,
      holds: g => g.edges.some(e => {
        const from = g.nodes.find(n => n.id === e.from)?.type
        const to = g.nodes.find(n => n.id === e.to)?.type
        return from === 'anchor' && to === 'window'
      }),
    }],
    acceptedVariants: [
      {
        nodes: [
          { id: 's', type: 'socket' }, { id: 'b', type: 'batcher' }, { id: 'r', type: 'buffer' },
          { id: 'a', type: 'anchor' }, { id: 'w', type: 'window' },
        ],
        edges: [
          { id: 'e1', from: 's', fromPort: 'lines', to: 'b', toPort: 'in' },
          { id: 'e2', from: 'b', fromPort: 'out', to: 'r', toPort: 'in' },
          { id: 'e3', from: 'r', fromPort: 'out', to: 'a', toPort: 'in' },
          { id: 'e4', from: 'a', fromPort: 'out', to: 'w', toPort: 'rows' },
        ],
      },
      {
        // No ring buffer: batch straight into the anchor. Also valid at lower volume.
        nodes: [
          { id: 's', type: 'socket' }, { id: 'b', type: 'batcher' }, { id: 'r', type: 'buffer' },
          { id: 'a', type: 'anchor' }, { id: 'w', type: 'window' }, { id: 'r2', type: 'buffer' },
        ],
        edges: [
          { id: 'e1', from: 's', fromPort: 'lines', to: 'b', toPort: 'in' },
          { id: 'e2', from: 'b', fromPort: 'out', to: 'r2', toPort: 'in' },
          { id: 'e3', from: 'r2', fromPort: 'out', to: 'a', toPort: 'in' },
          { id: 'e4', from: 'a', fromPort: 'out', to: 'w', toPort: 'rows' },
          { id: 'e5', from: 'r', fromPort: 'out', to: 'a', toPort: 'in' },
        ],
      },
    ],
    passThreshold: 0.7,
  },
}
export default spec
