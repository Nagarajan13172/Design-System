import type { Claim } from '../../types'

/**
 * Every `measurement` claim is asserted against sim.ts in sim.test.ts. The ordering
 * numbers were read off the schedule, not asserted and then made true.
 */
const claims: Claim[] = [
  {
    id: 'found-event-loop-c1',
    assertion: 'Synchronous code in a task runs to completion before any queued callback: nothing queued can run while the call stack is non-empty.',
    evidence: 'specification',
    flipCondition: 'Only if the callback ran on another thread — which is what a Web Worker is, and why it cannot touch the DOM.',
    conceptTokens: [['synchronous', 'sync'], ['call stack', 'stack'], ['before', 'first', 'completion']],
    probes: ['found-event-loop-i1', 'found-event-loop-i6'],
  },
  {
    id: 'found-event-loop-c2',
    assertion: 'The microtask queue drains completely at the end of every task — before the next task and before rendering — so a promise callback always precedes a timer or a rAF queued in the same handler.',
    evidence: 'specification',
    flipCondition: 'If the microtask were queued from inside a rAF callback instead, it would drain within the rendering steps rather than before them.',
    conceptTokens: [['microtask', 'promise', 'then'], ['drain', 'checkpoint', 'empties', 'completely'], ['before', 'precedes', 'ahead']],
    probes: ['found-event-loop-i2', 'found-event-loop-i7', 'found-event-loop-i10'],
  },
  {
    id: 'found-event-loop-c3',
    assertion: 'requestAnimationFrame runs inside the rendering steps at display cadence, while setTimeout(fn, 0) becomes an eligible task on the very next turn — so the 0ms timer usually runs BEFORE the rAF, and the order flips only once the timer delay exceeds the time remaining to the next frame.',
    evidence: 'measurement',
    flipCondition: 'A timer delay longer than the frame interval (about 17ms at 60Hz) puts the timer after the rAF.',
    conceptTokens: [['raf', 'requestanimationframe', 'rendering steps'], ['timer', 'settimeout'], ['before', 'first', 'earlier'], ['frame', 'cadence', 'boundary', '16', '17']],
    probes: ['found-event-loop-i3', 'found-event-loop-i8', 'found-event-loop-i9'],
  },
  {
    id: 'found-event-loop-c4',
    assertion: 'Rendering runs at most once per frame, so however many callbacks were queued into it there is exactly one paint.',
    evidence: 'measurement',
    flipCondition: 'A callback that forces synchronous layout mid-frame still produces one paint — it just makes the frame longer.',
    conceptTokens: [['once', 'one', 'single'], ['frame', 'paint', 'rendering']],
    probes: ['found-event-loop-i4'],
  },
  {
    id: 'found-event-loop-c5',
    assertion: 'A microtask that queues another microtask is drained in the same checkpoint, so an unbounded microtask chain starves rendering entirely: the page freezes without any single function blocking.',
    evidence: 'measurement',
    flipCondition: 'Queuing the continuation as a TASK instead — setTimeout, or scheduler.yield — lets rendering run between chunks.',
    conceptTokens: [['microtask', 'promise'], ['starve', 'freeze', 'never', 'blocks'], ['chain', 'queues another', 'recursive', 'unbounded']],
    probes: ['found-event-loop-i5', 'found-event-loop-i11'],
  },
]
export default claims
