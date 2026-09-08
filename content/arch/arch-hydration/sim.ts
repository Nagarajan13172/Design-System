/**
 * arch-hydration — what each rendering strategy actually costs, as a ledger.
 *
 * PURE. Every cell is DERIVED from the strategy's mechanics, so the matrix cannot
 * disagree with the claims. A ledger row without a flip condition is a pros-and-cons
 * list, which is why `flipsWhen` is required rather than optional.
 */
import { TimelineBuilder, note } from '../../../src/sim'
import type { Rng, Timeline, StateMatrixState } from '../../types'

export type Strategy = 'csr' | 'ssr' | 'ssg' | 'streaming' | 'islands'

interface Mechanics {
  label: string
  /** Does the server wait on data before the first byte? */
  serverFetchesFirst: boolean
  /** Is meaningful markup in the initial response? */
  markupInHtml: boolean
  /** Must the whole page be hydrated before anything is interactive? */
  hydratesEverything: boolean
  /** Can the response be personalised per request? */
  perRequest: boolean
  /** Roughly, the JS needed before the page responds to input. */
  jsBeforeInteractiveKb: number
}

const M: Record<Strategy, Mechanics> = {
  csr: { label: 'CSR', serverFetchesFirst: false, markupInHtml: false, hydratesEverything: false, perRequest: true, jsBeforeInteractiveKb: 180 },
  ssg: { label: 'SSG', serverFetchesFirst: false, markupInHtml: true, hydratesEverything: true, perRequest: false, jsBeforeInteractiveKb: 180 },
  ssr: { label: 'SSR', serverFetchesFirst: true, markupInHtml: true, hydratesEverything: true, perRequest: true, jsBeforeInteractiveKb: 180 },
  streaming: { label: 'Streaming SSR', serverFetchesFirst: false, markupInHtml: true, hydratesEverything: true, perRequest: true, jsBeforeInteractiveKb: 180 },
  islands: { label: 'Islands / RSC', serverFetchesFirst: false, markupInHtml: true, hydratesEverything: false, perRequest: true, jsBeforeInteractiveKb: 40 },
}

export type Axis = 'ttfb' | 'firstPaint' | 'interactive' | 'personalised' | 'infra'

/**
 * The honest reading of each strategy against each axis.
 * `good` is not "fast" — it is "this strategy does not pay this cost".
 */
export function cell(s: Strategy, axis: Axis): 'pass' | 'fail' | 'partial' {
  const m = M[s]
  switch (axis) {
    // SSR makes TTFB WORSE, which is the single most common misconception.
    case 'ttfb': return m.serverFetchesFirst ? 'fail' : 'pass'
    case 'firstPaint': return m.markupInHtml ? 'pass' : 'fail'
    case 'interactive': return m.hydratesEverything ? 'partial' : m.jsBeforeInteractiveKb > 100 ? 'fail' : 'pass'
    case 'personalised': return m.perRequest ? 'pass' : 'fail'
    // Anything rendering per request needs a server to operate, forever.
    case 'infra': return m.perRequest && s !== 'csr' ? 'fail' : 'pass'
  }
}

export interface Params { reveal: number; hydrationKb: number }
export const DEFAULTS: Params = { reveal: 5, hydrationKb: 180 }

const ORDER: Strategy[] = ['csr', 'ssg', 'ssr', 'streaming', 'islands']
const AXES: { id: Axis; label: string }[] = [
  { id: 'ttfb', label: 'TTFB unaffected' },
  { id: 'firstPaint', label: 'content in the HTML' },
  { id: 'interactive', label: 'interactive without full hydration' },
  { id: 'personalised', label: 'per-request personalisation' },
  { id: 'infra', label: 'no server to operate' },
]

function matrix(upto: number, cursor?: { row: string; col: string }): StateMatrixState {
  const rows = ORDER.map(s => ({ id: s, label: M[s].label }))
  const cells: StateMatrixState['cells'] = {}
  for (const s of ORDER.slice(0, upto)) {
    for (const a of AXES) cells[`${s}:${a.id}`] = { state: cell(s, a.id) }
  }
  return {
    rows, cols: AXES.map(a => ({ id: a.id, label: a.label })), cells, cursor,
    meter: { label: 'JS before interactive', value: M[ORDER[Math.max(0, upto - 1)]!].jsBeforeInteractiveKb, max: 200, unit: 'kb' },
  }
}

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<StateMatrixState> {
  const p = { ...DEFAULTS, ...params }
  const b = new TimelineBuilder<StateMatrixState>()

  b.stage('csr', 'CSR: nothing in the HTML, but nothing to wait for either')
  b.frame({
    narration: 'CSR ships an empty shell. TTFB is excellent because the server does no work — and there is nothing on screen until the bundle arrives and runs.',
    channels: ['cells'], explains: 'arch-hydration-c1',
    annotations: [note('a1', 'x', 0, 'fast TTFB, empty screen')],
    state: matrix(1, { row: 'csr', col: 'ttfb' }),
  })

  b.stage('ssr', 'SSR: content arrives, and TTFB gets worse')
  b.frame({
    narration: 'SSR puts content in the HTML, so first paint improves. But the server now fetches data before sending a single byte, so TTFB gets WORSE — the opposite of what "SSR is faster" implies.',
    channels: ['cells'], explains: 'arch-hydration-c2',
    annotations: [note('a2', 'x', 0, 'SSR trades TTFB for first paint', 'bad')],
    state: matrix(3, { row: 'ssr', col: 'ttfb' }),
  })

  b.stage('hydration', 'And the whole page still has to hydrate')
  b.frame({
    narration: `Markup arrives early, but the page is not interactive until ${p.hydrationKb}kb of JavaScript has downloaded, parsed and reattached every handler. Streaming re-orders that work; it does not remove it.`,
    channels: ['cells'], explains: 'arch-hydration-c3',
    annotations: [note('a3', 'x', 0, 'streaming re-orders, it does not shorten', 'bad')],
    state: matrix(4, { row: 'streaming', col: 'interactive' }),
  })

  b.stage('islands', 'Islands cut the work rather than moving it')
  b.frame({
    narration: 'Islands and RSC are the only rows that reduce the JavaScript needed before interaction, because most of the tree never becomes client components at all. That is a different kind of win from re-ordering.',
    channels: ['cells'], explains: 'arch-hydration-c4',
    annotations: [note('a4', 'x', 0, 'less JS, not earlier JS', 'good')],
    state: matrix(5, { row: 'islands', col: 'interactive' }),
  })

  const ghost = {
    label: 'CSR only',
    frames: [{
      t: 0, narration: 'The CSR row alone, for comparison.',
      channels: [], explains: 'arch-hydration-c1', annotations: [],
      state: matrix(1),
    }],
  }

  return b.build(ghost, {
    strategiesCompared: ORDER.length,
    jsBeforeInteractiveKb: M.islands.jsBeforeInteractiveKb,
    ssrTtfb: cell('ssr', 'ttfb'),
  })
}
