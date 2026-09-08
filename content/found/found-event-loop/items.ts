import type { Item } from '../../types'

/**
 * This module's verb is `explain`, so its items schedule and count for Coverage but
 * do not move Mastery — only judgment verbs do. `predict` is the figure's own gate.
 */
const items: Item[] = [
  {
    id: 'found-event-loop-i3', kind: 'predict', primaryClaim: 'found-event-loop-c3',
    prompt: 'Inside one click handler: setTimeout(A, 0), then Promise.resolve().then(B), then requestAnimationFrame(C), then console.log(D). Rank the order they run.',
    payload: { control: 'rank', correct: ['D', 'B', 'A', 'C'], whyPlausible: { 'D,B,C,A': 'The intuition is that rAF is "the fast one" because it runs before paint — but it waits for the frame boundary, and a 0ms timer does not.' } },
  },
  { id: 'found-event-loop-i1', kind: 'cloze', primaryClaim: 'found-event-loop-c1',
    prompt: 'Nothing queued can run while the ______ ______ is non-empty.',
    payload: { blanks: ['call', 'stack'], accept: { 0: ['call'], 1: ['stack'] } } },
  { id: 'found-event-loop-i6', kind: 'claim-recall', primaryClaim: 'found-event-loop-c1',
    prompt: 'Why can no queued callback interleave with synchronous code?' },
  { id: 'found-event-loop-i2', kind: 'order-steps', primaryClaim: 'found-event-loop-c2',
    prompt: 'Order one turn of the event loop.',
    payload: { steps: ['run a task to completion', 'drain the microtask queue entirely', 'run the rendering steps (rAF, style, layout, paint)', 'pick the next task'], hardOrder: [[0, 1], [1, 2]] } },
  { id: 'found-event-loop-i7', kind: 'cloze', primaryClaim: 'found-event-loop-c2',
    prompt: 'The microtask queue drains ______ at the end of every ______.',
    payload: { blanks: ['completely', 'task'], accept: { 0: ['completely', 'fully', 'entirely'], 1: ['task'] } } },
  { id: 'found-event-loop-i10', kind: 'claim-recall', primaryClaim: 'found-event-loop-c2',
    prompt: 'A promise callback and a setTimeout(0) are queued in the same handler. Which runs first, and why is it not a race?' },
  { id: 'found-event-loop-i8', kind: 'claim-recall', primaryClaim: 'found-event-loop-c3',
    prompt: 'setTimeout(fn, 0) versus requestAnimationFrame(fn), queued together. Which usually runs first, and what would flip it?' },
  { id: 'found-event-loop-i9', kind: 'cloze', primaryClaim: 'found-event-loop-c3',
    prompt: 'The order flips once the timer delay exceeds the time remaining to the next ______, roughly ______ ms at 60Hz.',
    payload: { blanks: ['frame', '17'], accept: { 0: ['frame', 'frame boundary'], 1: ['17', '16', '16.7'] } } },
  { id: 'found-event-loop-i4', kind: 'cloze', primaryClaim: 'found-event-loop-c4',
    prompt: 'However many callbacks were queued into it, a frame produces exactly ______ paint.',
    payload: { blanks: ['one'], accept: { 0: ['one', '1', 'a single'] } } },
  { id: 'found-event-loop-i5', kind: 'claim-recall', primaryClaim: 'found-event-loop-c5',
    prompt: 'A promise chain that always queues another promise never blocks any single function. Why does the page still freeze?' },
  { id: 'found-event-loop-i11', kind: 'order-steps', primaryClaim: 'found-event-loop-c5',
    prompt: 'You must process 100k items without freezing the page. Order the fix.',
    payload: { steps: ['split the work into chunks', 'yield between chunks as a TASK, not a microtask', 'let the rendering steps run', 'continue with the next chunk'], hardOrder: [[1, 2]] } },
]
export default items
