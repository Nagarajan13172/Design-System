import type { Item } from '../../types'

/**
 * Item kinds are bound to the module's objective verb (`diagnose`), and only the
 * MASTERY_KINDS below may move Mastery. `cloze`, `order-steps` and `claim-recall`
 * feed the scheduler only — reordering a sequence is recall of a sequence.
 */
const items: Item[] = [
  // --- predict (the figure's own gate) --------------------------------------
  {
    id: 'state-races-i1', kind: 'predict', primaryClaim: 'state-races-c1',
    prompt: 'With a 300ms debounce and response latency of median 120ms / p95 480ms, what percentage of typing sessions end with the screen showing results for a query the user has already replaced?',
    payload: { control: 'point', correct: 1.3, unit: '%', tolerance: { abs: 2.5 }, whyPlausible: { high: 'You are reasoning from how often responses overtake each other at all — but only the LAST arrival decides the final screen.', zero: 'Debounce feels like it serialises requests. It does not: it only widens the gap between them.' } },
  },
  {
    id: 'state-races-i6', kind: 'predict', primaryClaim: 'state-races-c6', secondaryClaim: 'state-races-c3',
    prompt: 'Same code, same 300ms debounce, but field p95 latency is 1500ms instead of 480ms. What is the stale-session rate now?',
    payload: { control: 'point', correct: 12.8, unit: '%', tolerance: { abs: 4 }, whyPlausible: { low: 'The debounce did not change, so it is tempting to expect the rate not to change either — but the race window is a ratio, not a constant.' } },
  },
  // --- mcq-with-rationale ---------------------------------------------------
  {
    id: 'state-races-i2', kind: 'mcq-rationale', primaryClaim: 'state-races-c2',
    prompt: 'A user reports the typeahead "sometimes shows the wrong thing". Your error tracker shows nothing, and every request returned 200. What is the most likely explanation?',
    payload: {
      options: ['A stale response rendered last', 'The server returned wrong data', 'A caching bug', 'The input state desynced from React'],
      correct: 0,
      rationales: ['Because arrival order is not dispatch order, and nothing about rendering a superseded response is an error condition', 'Because 200 means the body was correct for that query — which it was, for an older query', 'Because a cache would have to be involved for the data to be old', 'Because the input and results are separate state'],
      correctRationale: 0,
    },
  },
  {
    id: 'state-races-i5', kind: 'mcq-rationale', primaryClaim: 'state-races-c5',
    prompt: 'You call `controller.abort()` on an in-flight POST that creates an order. What can you conclude?',
    payload: {
      options: ['The order was not created', 'The order may have been created', 'The order was created but rolled back', 'The server returns 499'],
      correct: 1,
      rationales: ['Abort stops the server', 'Abort discards the client’s interest; the request may already have arrived and committed', 'Abort triggers a rollback', 'The status code tells you what happened'],
      correctRationale: 1,
    },
  },
  {
    id: 'state-races-i8', kind: 'mcq-rationale', primaryClaim: 'state-races-c2',
    prompt: 'Which signal would actually catch stale renders in production?',
    payload: {
      options: ['Error rate', 'p95 latency', 'A counter incremented when a response’s query !== the current input', 'HTTP status distribution'],
      correct: 2,
      rationales: ['Stale renders raise no errors', 'Latency is the cause, not the symptom', 'It is the only signal that compares the response to what the user is currently looking at', 'Every response is a 200'],
      correctRationale: 2,
    },
  },
  // --- constraint-flip (the workhorse) --------------------------------------
  {
    id: 'state-races-i3', kind: 'constraint-flip', primaryClaim: 'state-races-c3',
    prompt: 'You raise the debounce from 300ms to 800ms. What happens to the stale-render rate, and at what threshold does the trade stop being worth it?',
    payload: { direction: 'down', bands: ['0%', '<2%', '2-10%', '>10%'], correctBand: 0, flipParameter: 'perceived responsiveness', note: 'It reaches zero — by collapsing to roughly one request per session, which is a search box that feels broken.' },
  },
  {
    id: 'state-races-i9', kind: 'constraint-flip', primaryClaim: 'state-races-c6', secondaryClaim: 'state-races-c3',
    prompt: 'Your users move from office wifi (p95 480ms) to a train (p95 2500ms). The debounce is unchanged at 300ms. Which way does the stale rate move, and into which band?',
    payload: { direction: 'up', bands: ['<2%', '2-10%', '10-25%', '>25%'], correctBand: 2, flipParameter: 'p95 latency relative to the inter-dispatch gap' },
  },
  {
    id: 'state-races-i13', kind: 'constraint-flip', primaryClaim: 'state-races-c3',
    prompt: 'You remove the debounce entirely and fire on every keystroke, on a fast network. Which band does the stale rate land in?',
    payload: { direction: 'up', bands: ['<2%', '2-10%', '10-25%', '>25%'], correctBand: 2, flipParameter: 'inter-dispatch gap' },
  },
  // --- spot-the-failure -----------------------------------------------------
  {
    id: 'state-races-i7', kind: 'spot-the-failure', primaryClaim: 'state-races-c1',
    prompt: 'In this trace, click the exact moment the screen becomes wrong.',
    payload: { hitRegion: 'r0.arrive', failureClass: 'out-of-order-arrival', adjacentHint: 'Close — that is where the slow request was dispatched. The screen is not wrong until it lands.' },
  },
  {
    id: 'state-races-i11', kind: 'spot-the-failure', primaryClaim: 'state-races-c5',
    prompt: 'This client aborts the previous request on every keystroke and still double-charges a user. Click the line that causes it.',
    payload: { hitRegion: 'abort-on-mutation', failureClass: 'cancel-does-not-undo', adjacentHint: 'That line is correct for a GET. The bug is that the same pattern is applied to a request with effects.' },
  },
  // --- code-cloze -----------------------------------------------------------
  {
    id: 'state-races-i4', kind: 'code-cloze', primaryClaim: 'state-races-c4',
    prompt: 'Complete the sequence guard so a superseded response can never render.',
    payload: { blanks: [{ token: 'seq', occurrence: 2 }, { token: 'return' }], accept: { seq: ['seq', 'requestId', 'generation'], return: ['return'] } },
  },
  {
    id: 'state-races-i10', kind: 'code-cloze', primaryClaim: 'state-races-c4',
    prompt: 'Fill in the comparison that decides whether this response is still wanted.',
    payload: { blanks: [{ token: 'latest' }], accept: { latest: ['latest', 'current', 'newest'] } },
  },
  {
    id: 'state-races-i14', kind: 'code-diff', primaryClaim: 'state-races-c4', secondaryClaim: 'state-races-c5',
    prompt: 'Version A cancels; version B sequences. Which one still renders stale results, and which one still sends the request?',
    payload: { hunks: ['abort', 'seq-guard'], correctHunk: 1, defectClass: 'wasted-work-vs-wrong-render' },
  },
  {
    id: 'state-races-i12', kind: 'code-diff', primaryClaim: 'state-races-c1',
    prompt: 'Which of these two diffs actually changes what the user ends up seeing?',
    payload: { hunks: ['reorder-await', 'seq-guard'], correctHunk: 1, defectClass: 'ordering' },
  },
  // --- scheduler-only kinds (never move Mastery) ----------------------------
  {
    id: 'state-races-i15', kind: 'order-steps', primaryClaim: 'state-races-c1',
    prompt: 'Put this race in the order it actually happens.',
    payload: { steps: ['user pauses typing', 'debounce fires, request 3 dispatched', 'user types more, request 4 dispatched', 'request 4 arrives and renders', 'request 3 arrives and overwrites it', 'screen now disagrees with the input'], hardOrder: [[3, 4]] },
  },
  {
    id: 'state-races-i16', kind: 'cloze', primaryClaim: 'state-races-c4',
    prompt: 'A ______ request sequence number lets the client drop any response that is not the ______.',
    payload: { blanks: ['monotonic', 'newest'], accept: { 0: ['monotonic', 'increasing'], 1: ['newest', 'latest', 'current'] } },
  },
  {
    id: 'state-races-i17', kind: 'claim-recall', primaryClaim: 'state-races-c5',
    prompt: 'What does AbortController actually cancel?',
  },
]
export default items
