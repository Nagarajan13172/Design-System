/**
 * perf-field-vs-lab — a lab score is one point; the field is a distribution.
 *
 * PURE. Seeded rng, no clock, no React. The whole teaching point is a NUMBER
 * relationship (median moves, p75 does not), so the sim computes it and the claims
 * state what it computed.
 */
import { lognormalFromMedianP95, quantile, TimelineBuilder } from '../../../src/sim'
import type { Rng, Timeline, Plot2DState } from '../../types'

export interface Params {
  /** The lab machine: fast, warm, scripted. */
  labMs: number
  /** The field, as engineers describe it. */
  fieldMedianMs: number
  fieldP95Ms: number
  /** A fix that helps only sessions already faster than this. */
  fixHelpsBelowMs: number
  fixSavingMs: number
  sessions: number
  seed: number
}

export const DEFAULTS: Params = {
  labMs: 900, fieldMedianMs: 2200, fieldP95Ms: 6200,
  fixHelpsBelowMs: 2500, fixSavingMs: 700, sessions: 2000, seed: 20260908,
}

function mulberry(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Measurement {
  before: number[]
  after: number[]
  medianBefore: number; medianAfter: number
  p75Before: number; p75After: number
  p95Before: number; p95After: number
  /** Fraction of sessions the fix touched at all. */
  helped: number
}

/** A fix that only helps already-fast sessions: the classic median-only win. */
export function measure(p: Params = DEFAULTS): Measurement {
  const rng = mulberry(p.seed)
  const draw = lognormalFromMedianP95(p.fieldMedianMs, p.fieldP95Ms)
  const before: number[] = [], after: number[] = []
  let helped = 0
  for (let i = 0; i < p.sessions; i++) {
    const v = draw(rng)
    before.push(v)
    if (v < p.fixHelpsBelowMs) { helped++; after.push(Math.max(150, v - p.fixSavingMs)) }
    else after.push(v)
  }
  return {
    before, after,
    medianBefore: quantile(before, 0.5), medianAfter: quantile(after, 0.5),
    p75Before: quantile(before, 0.75), p75After: quantile(after, 0.75),
    p95Before: quantile(before, 0.95), p95After: quantile(after, 0.95),
    helped: helped / p.sessions,
  }
}

/** Bucket a sample into a histogram Plot2D can render. */
function hist(xs: number[], max: number, bins = 26): { x: number; y: number }[] {
  const w = max / bins
  const out = new Array(bins).fill(0) as number[]
  for (const v of xs) {
    const i = Math.min(bins - 1, Math.floor(v / w))
    if (i >= 0) out[i]! += 1
  }
  return out.map((y, i) => ({ x: (i + 0.5) * w, y }))
}

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<Plot2DState> {
  const p = { ...DEFAULTS, ...params }
  const m = measure(p)
  const max = Math.max(...m.before) * 0.72
  const axes = {
    xAxis: { label: 'LCP', unit: 'ms', min: 0, max },
    yAxis: { label: 'sessions' },
  } as const

  const b = new TimelineBuilder<Plot2DState>()

  b.stage('lab', 'The lab reports one point')
  b.frame({
    narration: `The lab machine loads it in ${Math.round(p.labMs)}ms. That is a real measurement of one scripted load on one device.`,
    channels: ['threshold'], explains: 'perf-field-vs-lab-c1',
    annotations: [],
    state: {
      ...axes, series: [],
      thresholds: [{ id: 'lab', axis: 'x', value: p.labMs, label: `lab ${Math.round(p.labMs)}ms`, tone: 'good' }],
    },
  })

  b.stage('field', 'The field reports a distribution')
  b.frame({
    narration: `Real sessions spread from under a second to well past six. The lab number sits at the very bottom of the distribution, not in the middle of it.`,
    channels: ['series'], explains: 'perf-field-vs-lab-c1',
    annotations: [{ id: 'a1', at: { x: p.labMs, y: 0 }, text: 'the lab lives here', tone: 'good' }],
    state: {
      ...axes,
      series: [{ id: 'before', label: 'field, before', kind: 'hist', tone: 'neutral', points: hist(m.before, max) }],
      thresholds: [
        { id: 'lab', axis: 'x', value: p.labMs, label: 'lab', tone: 'good' },
        { id: 'p75', axis: 'x', value: m.p75Before, label: `p75 ${Math.round(m.p75Before)}ms`, tone: 'bad' },
      ],
    },
  })

  b.stage('fix', 'A fix that helps the median and not the score')
  b.frame({
    narration: `The fix saves ${p.fixSavingMs}ms on the ${Math.round(m.helped * 100)}% of sessions that were already fast. Median improves by ${Math.round(m.medianBefore - m.medianAfter)}ms; p75 moves by ${Math.round(m.p75Before - m.p75After)}ms, because p75 is out in the part of the distribution the fix never touched.`,
    channels: ['series'], explains: 'perf-field-vs-lab-c2',
    annotations: [
      { id: 'a2', at: { x: m.medianAfter, y: 0 }, text: `median −${Math.round(m.medianBefore - m.medianAfter)}ms`, tone: 'good' },
      { id: 'a3', at: { x: m.p75Before, y: 0 }, text: `p75 −${Math.round(m.p75Before - m.p75After)}ms`, tone: 'bad' },
    ],
    state: {
      ...axes,
      series: [{ id: 'after', label: 'field, after', kind: 'hist', tone: 'accent', points: hist(m.after, max) }],
      thresholds: [
        { id: 'p75', axis: 'x', value: m.p75After, label: `p75 ${Math.round(m.p75After)}ms`, tone: 'bad' },
        { id: 'good', axis: 'x', value: 2500, label: 'CWV good ≤ 2500ms', tone: 'neutral' },
      ],
    },
  })

  const ghost = {
    label: 'before the fix',
    frames: [{
      t: 0,
      narration: 'The distribution before the fix, for comparison.',
      channels: [], explains: 'perf-field-vs-lab-c2',
      annotations: [],
      state: {
        ...axes,
        series: [{ id: 'before', label: 'before', kind: 'hist' as const, tone: 'ghost' as const, points: hist(m.before, max) }],
      },
    }],
  }

  return b.build(ghost, {
    labMs: Math.round(p.labMs),
    medianDeltaMs: Math.round(m.medianBefore - m.medianAfter),
    p75DeltaMs: Math.round(m.p75Before - m.p75After),
    sessionsHelpedPct: Math.round(m.helped * 100),
  })
}
