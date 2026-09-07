/**
 * state-races — request races in a typeahead.
 *
 * PURE. Injected clock, seeded rng, no React. The whole frame sequence is computed
 * eagerly so the figure can be scrubbed, replayed and — the point — asserted against
 * the claims it teaches (see sim.test.ts).
 */
import { lognormalFromMedianP95, quantile, TimelineBuilder, note } from '../../../src/sim'
import type { Rng, Timeline, LaneTimelineState, SpanKind } from '../../types'

export interface Params {
  /** Debounce window before a keystroke burst dispatches a request. */
  debounceMs: number
  /** Response latency distribution, stated the way engineers actually talk about it. */
  medianMs: number
  p95Ms: number
  /** Sessions to sample when measuring the stale-render rate. */
  sessions: number
  /** Cancel superseded requests (AbortController) — or don't. */
  cancellation: boolean
  /** Drop responses whose sequence number is not the newest — cheap and cancels nothing. */
  sequencing: boolean
  seed: number
}

export const DEFAULTS: Params = {
  debounceMs: 300, medianMs: 120, p95Ms: 480,
  sessions: 40, cancellation: false, sequencing: false, seed: 20260908,
}

interface Request { i: number; query: string; dispatch: number; arrive: number; latency: number }

/** One typing session: keystrokes, debounced dispatches, and their arrival times. */
function session(rng: Rng, p: Params): Request[] {
  const latency = lognormalFromMedianP95(p.medianMs, p.p95Ms)
  const chars = 8 + Math.floor(rng() * 7)

  // Real typing is bursty: mostly fast, with pauses that are exactly what lets a
  // debounce fire more than once for a single query.
  const keys: number[] = []
  let t = 0
  for (let i = 0; i < chars; i++) {
    const pause = rng() < 0.25
    t += pause ? 340 + rng() * 460 : 90 + rng() * 110
    keys.push(t)
  }

  // A keystroke dispatches iff no further keystroke lands inside the debounce window.
  const reqs: Request[] = []
  keys.forEach((k, i) => {
    const next = keys[i + 1]
    if (next !== undefined && next - k < p.debounceMs) return
    const dispatch = k + p.debounceMs
    const l = Math.max(8, latency(rng))
    reqs.push({ i: reqs.length, query: 'q'.repeat(i + 1), dispatch, arrive: dispatch + l, latency: l })
  })
  return reqs
}

/**
 * What the user is left looking at.
 *
 * Naive client: render whatever arrives, whenever it arrives. The final render is
 * STALE when the last response to ARRIVE is not the response to the last request
 * DISPATCHED — which is a different condition from "a response arrived late".
 */
function finalIsStale(reqs: Request[], p: Params): boolean {
  if (reqs.length < 2) return false
  const live = p.cancellation
    // Cancellation: a superseded request is aborted at the moment the next one is
    // dispatched, so it can never render.
    ? reqs.filter((r, i) => { const nxt = reqs[i + 1]; return !nxt || r.arrive < nxt.dispatch })
    : reqs
  if (p.sequencing) return false            // a stale response is dropped on arrival
  let last = live[0]!
  for (const r of live) if (r.arrive >= last.arrive) last = r
  return last.i !== reqs[reqs.length - 1]!.i
}

export interface Measurement {
  staleRate: number
  sessions: number
  racedSessions: number
  medianLatency: number
  p95Latency: number
  avgRequestsPerSession: number
}

/** The measurement the claims are written against. */
export function measure(p: Params = DEFAULTS): Measurement {
  const rng = mulberry(p.seed)
  let stale = 0, raced = 0, reqCount = 0
  const lats: number[] = []
  for (let s = 0; s < p.sessions; s++) {
    const reqs = session(rng, p)
    reqCount += reqs.length
    for (const r of reqs) lats.push(r.latency)
    if (reqs.length > 1) raced++
    if (finalIsStale(reqs, p)) stale++
  }
  return {
    staleRate: stale / p.sessions,
    sessions: p.sessions,
    racedSessions: raced,
    medianLatency: quantile(lats, 0.5),
    p95Latency: quantile(lats, 0.95),
    avgRequestsPerSession: reqCount / p.sessions,
  }
}

// local copy so the sim has exactly one dependency direction
function mulberry(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function run(params: Partial<Params> = {}, ctx?: { rng?: Rng }): Timeline<LaneTimelineState> {
  const p = { ...DEFAULTS, ...params }
  void ctx
  const rng = mulberry(p.seed)

  // One representative raced session drives the figure; the measurement drives the readout.
  let reqs: Request[] = []
  for (let i = 0; i < 200 && reqs.length < 3; i++) reqs = session(rng, p)
  const m = measure(p)

  const lanes: LaneTimelineState['lanes'] = [
    { id: 'user', label: 'keystrokes', role: 'actor' },
    ...reqs.map(r => ({ id: `r${r.i}`, label: `request ${r.i + 1}`, role: 'resource' as const })),
    { id: 'screen', label: 'what the user sees', role: 'thread' as const },
  ]
  const winner = reqs.reduce((a, b) => (b.arrive >= a.arrive ? b : a))
  const newest = reqs[reqs.length - 1]!
  const stale = winner.i !== newest.i

  const b = new TimelineBuilder<LaneTimelineState>()
  const spansUpTo = (t: number) => reqs
    .filter(r => r.dispatch <= t)
    .map(r => ({
      id: `s${r.i}`, laneId: `r${r.i}`, t0: r.dispatch, t1: Math.min(r.arrive, t),
      label: r.query, kind: (r.arrive <= t && r.i !== newest.i && r.arrive > newest.arrive ? 'stale' : 'network') as SpanKind,
    }))

  b.stage('dispatch', 'Requests go out in order')
  b.frame({
    narration: `${reqs.length} requests are dispatched, one per typing pause, in query order.`,
    channels: ['requests'], explains: 'state-races-c1',
    annotations: [note('a1', 'user', reqs[0]!.dispatch, `debounce ${p.debounceMs}ms`)],
    state: { lanes, spans: spansUpTo(newest.dispatch), head: newest.dispatch },
  })

  b.stage('arrive', 'Responses come back in a different order')
  b.frame({
    narration: `Responses arrive out of order: request ${winner.i + 1} lands last, at ${Math.round(winner.arrive)}ms, after request ${newest.i + 1} already rendered.`,
    channels: ['requests', 'screen'], explains: 'state-races-c1',
    annotations: [
      note('a2', `r${winner.i}`, winner.arrive, `arrives last (${Math.round(winner.latency)}ms)`, stale ? 'bad' : 'good'),
      note('a3', `r${newest.i}`, newest.arrive, 'newest query', 'neutral'),
    ],
    state: { lanes, spans: spansUpTo(winner.arrive + 1), head: winner.arrive },
  })

  b.stage('render', 'The screen keeps whatever landed last')
  b.frame({
    narration: stale
      ? `The screen shows results for "${winner.query}" while the input reads "${newest.query}". Nothing errored; every request succeeded.`
      : `The newest response happened to land last, so the screen is correct — this time.`,
    channels: ['screen'], explains: 'state-races-c2',
    annotations: [
      note('a4', 'screen', winner.arrive, stale ? 'stale results, no error' : 'correct, by luck', stale ? 'bad' : 'good'),
      note('a5', 'screen', newest.arrive, `${Math.round(m.staleRate * 100)}% of sessions end this way`, 'bad'),
    ],
    state: { lanes, spans: spansUpTo(winner.arrive + 1), head: winner.arrive + 1 },
  })

  // The ghost baseline: the same seeded session with sequencing on.
  const ghostP = { ...p, sequencing: true }
  const gm = measure(ghostP)
  const ghost = {
    label: 'with sequence numbers',
    frames: [{
      t: 0,
      narration: `With a monotonic sequence number, a superseded response is dropped on arrival: ${Math.round(gm.staleRate * 100)}% stale renders.`,
      channels: [], explains: 'state-races-c4',
      annotations: [note('g1', 'screen', newest.arrive, 'newest query wins, always', 'good')],
      state: { lanes, spans: spansUpTo(winner.arrive + 1).map(s => ({ ...s, kind: 'network' as const })), head: winner.arrive + 1 },
    }],
  }

  return b.build(ghost, {
    staleRatePct: Math.round(m.staleRate * 100),
    medianLatencyMs: Math.round(m.medianLatency),
    p95LatencyMs: Math.round(m.p95Latency),
    requestsPerSession: Number(m.avgRequestsPerSession.toFixed(1)),
  })
}
