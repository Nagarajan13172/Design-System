/**
 * ui-stacking-context — why a z-index of 9999 loses to a z-index of 10.
 *
 * PURE. The stacking tree and the painting order are DERIVED from CSS properties,
 * not authored per frame, so the figure cannot drift out of agreement with the rule
 * it teaches.
 */
import { TimelineBuilder, note } from '../../../src/sim'
import type { Rng, Timeline, NodeGraphState } from '../../types'

/** The properties that create a stacking context. Not an exhaustive list — the ones people hit. */
export interface ElementSpec {
  id: string
  label: string
  parent: string | null
  zIndex?: number
  position?: 'static' | 'relative' | 'absolute' | 'fixed'
  transform?: boolean
  opacity?: number
  filter?: boolean
  willChange?: boolean
  isolation?: boolean
}

export interface Params {
  /** The 'for GPU acceleration' translateZ(0) somebody added months ago. */
  cardHasTransform: boolean
  /** Move the modal to the top layer instead (dialog / popover). */
  useTopLayer: boolean
}
export const DEFAULTS: Params = { cardHasTransform: true, useTopLayer: false }

function tree(p: Params): ElementSpec[] {
  return [
    { id: 'root', label: 'html', parent: null },
    { id: 'header', label: 'sticky header\nz-index: 10', parent: 'root', position: 'relative', zIndex: 10 },
    { id: 'main', label: 'main', parent: 'root' },
    { id: 'card', label: p.cardHasTransform ? 'card\ntransform: translateZ(0)' : 'card\n(no transform)', parent: 'main', transform: p.cardHasTransform },
    { id: 'modal', label: 'modal\nposition: fixed\nz-index: 9999', parent: 'card', position: 'fixed', zIndex: 9999 },
  ]
}

/** Does this element create a stacking context? */
export function createsContext(e: ElementSpec): boolean {
  if (e.parent === null) return true                                   // the root always does
  if (e.transform || e.filter || e.willChange || e.isolation) return true
  if (e.opacity != null && e.opacity < 1) return true
  if (e.zIndex != null && e.position && e.position !== 'static') return true
  return false
}

/** The nearest ancestor stacking context an element participates in. */
export function contextOf(e: ElementSpec, all: ElementSpec[]): string {
  let cur = all.find(x => x.id === e.parent)
  while (cur) {
    if (createsContext(cur)) return cur.id
    cur = all.find(x => x.id === cur!.parent)
  }
  return 'root'
}

export interface Verdict {
  /** Which context the modal is trapped in. */
  modalContext: string
  /** Does the modal paint above the header? */
  aboveHeader: boolean
  /** Does `position: fixed` still resolve against the viewport? */
  fixedToViewport: boolean
  reason: string
}

export function resolve(p: Params = DEFAULTS): Verdict {
  const all = tree(p)
  const modal = all.find(e => e.id === 'modal')!
  const card = all.find(e => e.id === 'card')!

  if (p.useTopLayer) {
    return {
      modalContext: 'top-layer', aboveHeader: true, fixedToViewport: true,
      reason: 'The top layer sits outside the stacking tree entirely, so no ancestor can trap it.',
    }
  }

  const ctx = contextOf(modal, all)
  // A transformed ancestor traps descendants AND becomes the containing block for
  // `position: fixed` — two separate consequences of one property.
  const trapped = ctx === 'card' && createsContext(card)
  return {
    modalContext: ctx,
    aboveHeader: !trapped,
    fixedToViewport: !card.transform,
    reason: trapped
      ? "The card's transform created a stacking context, so the modal's z-index of 9999 is only compared against its siblings inside the card. The card itself has no z-index, so it loses to the header's 10."
      : 'The modal participates in the root stacking context, so 9999 beats the header.',
  }
}

const NODES = (p: Params, ctxIds: Set<string>): NodeGraphState['nodes'] => [
  { id: 'root', label: 'html', x: 20, y: 16, w: 96 },
  { id: 'header', label: 'header z:10', x: 150, y: 16, w: 120 },
  { id: 'main', label: 'main', x: 20, y: 84, w: 96 },
  { id: 'card', label: p.cardHasTransform ? 'card · transform' : 'card', x: 150, y: 84, w: 132 },
  { id: 'modal', label: 'modal z:9999', x: 320, y: 84, w: 130 },
  ...(ctxIds.size ? [] : []),
]

const EDGES: NodeGraphState['edges'] = [
  { id: 'e1', from: 'root', to: 'header', kind: 'contains' },
  { id: 'e2', from: 'root', to: 'main', kind: 'contains' },
  { id: 'e3', from: 'main', to: 'card', kind: 'contains' },
  { id: 'e4', from: 'card', to: 'modal', kind: 'contains' },
]

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<NodeGraphState> {
  const p = { ...DEFAULTS, ...params }
  const all = tree(p)
  const v = resolve(p)
  const contexts = new Set(all.filter(createsContext).map(e => e.id))

  const base = (nodeState: NodeGraphState['nodeState'], extra?: Partial<NodeGraphState>): NodeGraphState => ({
    nodes: NODES(p, contexts), edges: EDGES, nodeState, ...extra,
  })

  const b = new TimelineBuilder<NodeGraphState>()

  b.stage('tree', 'The DOM tree everyone agrees on')
  b.frame({
    narration: 'The modal is nested inside the card, which is inside main. Nothing surprising yet.',
    channels: ['nodes'], explains: 'ui-stacking-context-c1',
    annotations: [note('a1', 'modal', 0, 'z-index: 9999')],
    state: base({ root: 'idle', header: 'idle', main: 'idle', card: 'idle', modal: 'active' }),
  })

  b.stage('contexts', 'Which elements create a stacking context')
  b.frame({
    narration: `${contexts.size} element${contexts.size === 1 ? '' : 's'} create a stacking context: ${[...contexts].join(', ')}. \`transform\` does it, and so does a z-index on a positioned element.`,
    channels: ['nodes'], explains: 'ui-stacking-context-c2',
    annotations: p.cardHasTransform
      ? [note('a2', 'card', 0, 'transform creates one', 'bad')]
      : [note('a2', 'card', 0, 'plain box — creates none', 'good')],
    state: base(Object.fromEntries(all.map(e => [e.id, contexts.has(e.id) ? 'flagged' : 'idle'])) as NodeGraphState['nodeState']),
  })

  b.stage('compare', 'z-index is only compared inside one context')
  b.frame({
    narration: v.reason,
    channels: ['nodes', 'wave'], explains: 'ui-stacking-context-c3',
    annotations: [
      note('a3', 'modal', 0, v.aboveHeader ? 'paints above the header' : 'trapped — 9999 never meets 10', v.aboveHeader ? 'good' : 'bad'),
      note('a4', 'header', 0, 'z-index: 10'),
    ],
    state: base(
      { root: 'idle', header: 'active', main: 'dim', card: v.aboveHeader ? 'dim' : 'blocked', modal: v.aboveHeader ? 'visited' : 'blocked' },
      { wave: { from: v.modalContext === 'card' ? 'card' : 'root', radius: 78 }, activePath: ['card', 'modal'] },
    ),
  })

  b.stage('fixed', 'And the same property moved the containing block')
  b.frame({
    narration: v.fixedToViewport
      ? 'With no transformed ancestor, `position: fixed` resolves against the viewport, so the backdrop covers the screen.'
      : 'The transform also became the containing block for `position: fixed`, so the backdrop covers the card, not the viewport. One property, two separate consequences.',
    channels: ['nodes'], explains: 'ui-stacking-context-c4',
    annotations: [note('a5', 'card', 0, v.fixedToViewport ? 'viewport-relative' : 'containing block for fixed', v.fixedToViewport ? 'good' : 'bad')],
    state: base({ root: 'dim', header: 'dim', main: 'dim', card: v.fixedToViewport ? 'dim' : 'blocked', modal: 'active' }),
  })

  const clean = resolve({ ...p, cardHasTransform: false })
  const ghost = {
    label: 'without the transform',
    frames: [{
      t: 0,
      narration: `Remove the transform and the modal paints above the header again: ${clean.reason}`,
      channels: [], explains: 'ui-stacking-context-c3',
      annotations: [note('g1', 'modal', 0, 'reaches the root context', 'good')],
      state: base({ root: 'idle', header: 'dim', main: 'dim', card: 'dim', modal: 'visited' }),
    }],
  }

  return b.build(ghost, {
    modalPaintsAboveHeader: v.aboveHeader ? 'yes' : 'no',
    trappedInContext: v.modalContext,
    backdropCovers: v.fixedToViewport ? 'the viewport' : 'the card',
  })
}
