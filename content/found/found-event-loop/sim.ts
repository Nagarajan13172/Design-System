/**
 * found-event-loop — what actually runs, in what order, and when the pixels change.
 *
 * PURE. No clock, no rng, no React. The whole point of this module is that ORDER is
 * a consequence of a schedule, so the schedule is computed explicitly and asserted.
 */
import { TimelineBuilder, note } from '../../../src/sim'
import type { Rng, Timeline, LaneTimelineState, SpanKind } from '../../types'

export interface Params {
  /** setTimeout(A, delay). The interesting range is 0-30ms. */
  timerDelayMs: number
  /** Display cadence. 16.7 at 60Hz, 8.3 at 120Hz. */
  frameIntervalMs: number
  /** How long the click handler itself runs before returning. */
  handlerMs: number
  /** Each queued microtask that queues another one. Drives the starvation claim. */
  microtaskChain: number
}

export const DEFAULTS: Params = { timerDelayMs: 0, frameIntervalMs: 16.7, handlerMs: 2, microtaskChain: 1 }

export interface Scheduled { label: string; lane: string; at: number; dur: number; kind: SpanKind }

export interface Schedule {
  events: Scheduled[]
  /** Callback labels in the order they actually run. */
  order: string[]
  paints: number
  /** True when the microtask queue never drains, so rendering never runs. */
  starved: boolean
}

const TASK_PICK_MS = 0.5   // event-loop overhead before the next task is selected
const MICROTASK_MS = 0.2

/**
 * The schedule.
 *
 * Handler task -> microtask checkpoint -> next event-loop turn. A due timer becomes
 * an eligible TASK; rAF callbacks run inside the RENDERING STEPS, which the browser
 * runs at display cadence. Which of the two happens first is therefore a race
 * between the timer's delay and the time remaining until the next frame — not a
 * rule, which is exactly what makes the usual mental model wrong.
 */
export function schedule(p: Params = DEFAULTS): Schedule {
  const events: Scheduled[] = []
  const order: string[] = []

  const handlerEnd = p.handlerMs
  events.push({ label: 'click handler (D logs)', lane: 'stack', at: 0, dur: handlerEnd, kind: 'work' })
  order.push('D')

  // Microtask checkpoint: drains COMPLETELY at the end of the task, before the
  // next task and before rendering.
  const microEnd = handlerEnd + p.microtaskChain * MICROTASK_MS
  if (p.microtaskChain > 0) {
    events.push({ label: `microtasks (B) x${p.microtaskChain}`, lane: 'micro', at: handlerEnd, dur: microEnd - handlerEnd, kind: 'work' })
    order.push('B')
  }

  // Unbounded chain: the checkpoint never ends, so no task and no frame ever runs.
  const starved = p.microtaskChain >= 5000
  if (starved) {
    events.push({ label: 'rendering never reached', lane: 'render', at: microEnd, dur: 0, kind: 'error' })
    return { events, order, paints: 0, starved }
  }

  const timerReady = Math.max(microEnd + TASK_PICK_MS, p.timerDelayMs)
  const nextFrame = Math.ceil(microEnd / p.frameIntervalMs) * p.frameIntervalMs

  if (timerReady <= nextFrame) {
    events.push({ label: 'setTimeout task (A)', lane: 'task', at: timerReady, dur: 1, kind: 'work' })
    order.push('A')
    events.push({ label: 'rendering steps: rAF (C), then paint', lane: 'render', at: nextFrame, dur: 2, kind: 'paint' })
    order.push('C')
  } else {
    events.push({ label: 'rendering steps: rAF (C), then paint', lane: 'render', at: nextFrame, dur: 2, kind: 'paint' })
    order.push('C')
    events.push({ label: 'setTimeout task (A)', lane: 'task', at: timerReady, dur: 1, kind: 'work' })
    order.push('A')
  }

  // One paint per frame, regardless of how many callbacks were queued into it.
  return { events, order, paints: 1, starved }
}

const LANES: LaneTimelineState['lanes'] = [
  { id: 'stack', label: 'call stack', role: 'thread' },
  { id: 'micro', label: 'microtask queue', role: 'resource' },
  { id: 'task', label: 'task queue', role: 'resource' },
  { id: 'render', label: 'rendering steps', role: 'thread' },
]

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<LaneTimelineState> {
  const p = { ...DEFAULTS, ...params }
  const s = schedule(p)
  const spans = (upto: number) => s.events
    .filter(e => e.at <= upto)
    .map((e, i) => ({ id: `e${i}`, laneId: e.lane, t0: e.at, t1: Math.min(e.at + e.dur, upto), label: e.label, kind: e.kind }))

  const b = new TimelineBuilder<LaneTimelineState>()
  const at = (n: number) => s.events[n]?.at ?? 0
  const end = (n: number) => (s.events[n] ? s.events[n]!.at + s.events[n]!.dur : 0)

  b.stage('sync', 'The handler runs to completion')
  b.frame({
    narration: 'D logs synchronously. Nothing queued can run while the call stack is non-empty.',
    channels: ['stack'], explains: 'found-event-loop-c1',
    annotations: [note('a1', 'stack', 0, 'D logs here')],
    state: { lanes: LANES, spans: spans(end(0)), head: end(0) },
  })

  b.stage('micro', 'The microtask checkpoint drains, completely')
  b.frame({
    narration: 'The task ends, so the microtask queue drains in full — before the next task and before any rendering. B runs here.',
    channels: ['micro'], explains: 'found-event-loop-c2',
    annotations: [note('a2', 'micro', at(1), 'B — before A and C', 'good')],
    state: { lanes: LANES, spans: spans(end(1)), head: end(1) },
  })

  b.stage('race', 'Timer versus frame — a race, not a rule')
  const timerFirst = s.order.indexOf('A') < s.order.indexOf('C')
  b.frame({
    narration: timerFirst
      ? `A 0ms timer is eligible on the very next turn, while rAF waits for the frame boundary at ${Math.round(s.events.at(-1)!.at)}ms. So A runs before C — the opposite of the usual mental model.`
      : `The timer's ${p.timerDelayMs}ms delay pushes it past the frame boundary, so C runs first. Same code, different order.`,
    channels: ['task', 'render'], explains: 'found-event-loop-c3',
    annotations: [
      note('a3', 'task', s.events.find(e => e.lane === 'task')?.at ?? 0, `A at ${Math.round(s.events.find(e => e.lane === 'task')?.at ?? 0)}ms`, timerFirst ? 'good' : 'neutral'),
      note('a4', 'render', s.events.find(e => e.lane === 'render')?.at ?? 0, `C at the frame boundary`, timerFirst ? 'neutral' : 'good'),
    ],
    state: { lanes: LANES, spans: spans(1e6), head: 1e6 },
  })

  b.stage('paint', 'One frame, one paint')
  b.frame({
    narration: `Order: ${s.order.join(' → ')}. Exactly ${s.paints} paint — rendering runs once per frame no matter how many callbacks were queued into it.`,
    channels: ['render'], explains: 'found-event-loop-c4',
    annotations: [note('a5', 'render', s.events.at(-1)!.at, `${s.paints} paint`, 'good')],
    state: { lanes: LANES, spans: spans(1e6), head: 1e6 },
  })

  // Ghost: the same code with the timer pushed past the frame boundary.
  const ghostP = { ...p, timerDelayMs: Math.round(p.frameIntervalMs) + 5 }
  const g = schedule(ghostP)
  const ghost = {
    label: 'with a 22ms timer',
    frames: [{
      t: 0,
      narration: `With a ${ghostP.timerDelayMs}ms delay the order becomes ${g.order.join(' → ')}. The ordering is a race, not a property of the APIs.`,
      channels: [], explains: 'found-event-loop-c3',
      annotations: [note('g1', 'task', g.events.find(e => e.lane === 'task')?.at ?? 0, 'A now lands after C', 'neutral')],
      state: {
        lanes: LANES,
        spans: g.events.map((e, i) => ({ id: `g${i}`, laneId: e.lane, t0: e.at, t1: e.at + e.dur, label: e.label, kind: e.kind })),
      },
    }],
  }

  return b.build(ghost, {
    order: s.order.join(' → '),
    paints: s.paints,
    timerAtMs: Math.round(s.events.find(e => e.lane === 'task')?.at ?? 0),
    frameAtMs: Math.round(s.events.find(e => e.lane === 'render')?.at ?? 0),
  })
}
