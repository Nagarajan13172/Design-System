/**
 * state-taxonomy — where a piece of truth lives, and what that choice costs.
 *
 * PURE. The failure modes are DERIVED from the properties of each placement rather
 * than authored per cell, so the matrix cannot drift out of agreement with the
 * claims it teaches.
 */
import { TimelineBuilder, note } from '../../../src/sim'
import type { Rng, Timeline, StateMatrixState } from '../../types'

export type Placement = 'component' | 'client-store' | 'url' | 'server-cache'

/** What each placement structurally gives you. Not opinions — mechanics. */
const PROPS: Record<Placement, {
  label: string
  survivesRemount: boolean
  sharedBetweenComponents: boolean
  survivesReload: boolean
  shareableByLink: boolean
  /** Does anything cause it to be re-read from the source of truth? */
  revalidates: boolean
}> = {
  component: { label: 'useState in a component', survivesRemount: false, sharedBetweenComponents: false, survivesReload: false, shareableByLink: false, revalidates: false },
  'client-store': { label: 'a global client store', survivesRemount: true, sharedBetweenComponents: true, survivesReload: false, shareableByLink: false, revalidates: false },
  url: { label: 'the URL', survivesRemount: true, sharedBetweenComponents: true, survivesReload: true, shareableByLink: true, revalidates: false },
  'server-cache': { label: 'a server cache with a freshness policy', survivesRemount: true, sharedBetweenComponents: true, survivesReload: true, shareableByLink: false, revalidates: true },
}

export type Failure = 'disagreement' | 'lostOnRemount' | 'staleAfterExternalChange' | 'notShareable'

/**
 * The failures a SERVER-OWNED value suffers in each placement.
 * `unreadCount` is owned by the server and changed by things this tab cannot see —
 * another tab, another device, a background job.
 */
export function failuresFor(p: Placement): Failure[] {
  const x = PROPS[p]
  const out: Failure[] = []
  if (!x.sharedBetweenComponents) out.push('disagreement')
  if (!x.survivesRemount) out.push('lostOnRemount')
  if (!x.revalidates) out.push('staleAfterExternalChange')
  if (!x.shareableByLink) out.push('notShareable')
  return out
}

export interface Params { placement: Placement; serverOwned: boolean }
export const DEFAULTS: Params = { placement: 'client-store', serverOwned: true }

const ROWS = (Object.keys(PROPS) as Placement[]).map(k => ({ id: k, label: PROPS[k].label }))
const COLS: { id: Failure; label: string }[] = [
  { id: 'disagreement', label: 'components disagree' },
  { id: 'lostOnRemount', label: 'lost on remount' },
  { id: 'staleAfterExternalChange', label: 'stale after a change elsewhere' },
  { id: 'notShareable', label: 'not shareable by link' },
]

function matrix(revealed: Placement[], cursor?: { row: string; col: string }): StateMatrixState {
  const cells: StateMatrixState['cells'] = {}
  for (const r of ROWS) {
    if (!revealed.includes(r.id as Placement)) continue
    const f = failuresFor(r.id as Placement)
    for (const c of COLS) cells[`${r.id}:${c.id}`] = { state: f.includes(c.id) ? 'fail' : 'pass' }
  }
  const worst = revealed.length ? Math.max(...revealed.map(p => failuresFor(p).length)) : 0
  return { rows: ROWS, cols: COLS, cells, cursor, meter: { label: 'failure modes', value: worst, max: COLS.length } }
}

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<StateMatrixState> {
  const p = { ...DEFAULTS, ...params }
  const b = new TimelineBuilder<StateMatrixState>()

  b.stage('component', 'Start where everyone starts')
  b.frame({
    narration: 'Local component state: the sidebar and the header each fetch their own copy, so they can disagree, and both lose the value on remount.',
    channels: ['cells'], explains: 'state-taxonomy-c1',
    annotations: [note('a1', 'x', 0, 'two copies of one truth')],
    state: matrix(['component'], { row: 'component', col: 'disagreement' }),
  })

  b.stage('store', 'Reach for a global store — the usual fix')
  b.frame({
    narration: 'A global store fixes disagreement and remount loss. It does nothing about freshness: nothing re-reads the server, so the count is still wrong the moment another tab marks a message read.',
    channels: ['cells'], explains: 'state-taxonomy-c2',
    annotations: [
      note('a2', 'x', 0, 'two columns fixed', 'good'),
      note('a3', 'x', 0, 'the one that actually fires is still red', 'bad'),
    ],
    state: matrix(['component', 'client-store'], { row: 'client-store', col: 'staleAfterExternalChange' }),
  })

  b.stage('url', 'The URL is state too')
  b.frame({
    narration: 'The URL survives reload and is shareable — which is why filters and tabs belong there. It still never revalidates, so it is the wrong home for server-owned data.',
    channels: ['cells'], explains: 'state-taxonomy-c3',
    annotations: [note('a4', 'x', 0, 'shareable, still stale')],
    state: matrix(['component', 'client-store', 'url'], { row: 'url', col: 'notShareable' }),
  })

  b.stage('cache', 'Server data is a cache, not application state')
  b.frame({
    narration: 'Treating it as a cache with an explicit freshness policy is the only placement that closes the column that was actually failing.',
    channels: ['cells'], explains: 'state-taxonomy-c4',
    annotations: [note('a5', 'x', 0, 'the only row with staleness closed', 'good')],
    state: matrix(['component', 'client-store', 'url', 'server-cache'], { row: 'server-cache', col: 'staleAfterExternalChange' }),
  })

  const ghost = {
    label: 'the placement people pick',
    frames: [{
      t: 0,
      narration: 'A global client store fixes the two failures that were not happening and leaves the one that was.',
      channels: [], explains: 'state-taxonomy-c2',
      annotations: [note('g1', 'x', 0, 'right answer to the wrong question')],
      state: matrix(['client-store']),
    }],
  }

  return b.build(ghost, {
    placement: p.placement,
    failureModes: failuresFor(p.placement).length,
    remaining: failuresFor(p.placement).join(', ') || 'none',
  })
}
