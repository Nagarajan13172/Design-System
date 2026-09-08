import type { CaseSpec } from '../../types'
import { canvasKey } from './sim'

/**
 * The WORKED and FADED rungs run on this case. The independent rung deliberately
 * does not — it runs on `cs-log-tail`, which shares the structure (an unbounded
 * stream rendered into a bounded surface, guarded on the edge) and none of the
 * surface details.
 */
const spec: CaseSpec = {
  id: 'cs-autocomplete',
  moduleId: 'cs-autocomplete',
  prompt:
    'Design the search box for a product catalogue. It suggests as you type, and the team has ' +
    'noticed it "sometimes shows the wrong thing". Take me through how you would build it.',

  requirements: [
    { id: 'r1', text: 'Suggestions appear as the user types', blastRadius: 'none' },
    { id: 'r2', text: 'The list must never show results for a query the user has replaced', blastRadius: 'high' },
    { id: 'r3', text: 'Works on a mid-tier Android over a slow connection', blastRadius: 'high' },
    { id: 'r4', text: 'The endpoint costs money per call', blastRadius: 'some' },
    { id: 'r5', text: 'Results are branded with a logo', blastRadius: 'none' },
    { id: 'r6', text: 'Keyboard-navigable and screen-reader announced', blastRadius: 'some' },
  ],

  decisionPoints: [
    {
      id: 'd1', question: 'First move: what do you ask before designing anything?',
      options: [
        'How many results to show',
        'Whether a stale list is acceptable, and on what connection',
        'Which state library to use',
        'Whether to use GraphQL',
      ],
      correct: 1,
      why: 'Two of the six requirements are high blast radius — correctness under replacement, and the network. Everything downstream is decided by those, and neither is about a library.',
    },
    {
      id: 'd2', question: 'Requests per keystroke, or debounced?',
      options: ['Per keystroke — lowest latency', 'Debounced — fewer calls', 'Neither; poll on an interval', 'Batch on blur'],
      correct: 1,
      why: 'The endpoint costs money and the connection is slow, so volume matters. But say what the debounce buys — request volume — and be explicit that it does not touch correctness.',
    },
    {
      id: 'd3', question: 'The debounce is in. Is the stale-list requirement met?',
      options: ['Yes', 'No — it is unrelated to ordering', 'Only above 400ms', 'Only with HTTP/2'],
      correct: 1,
      why: 'A debounce spaces dispatches; it has no opinion about which response arrives last. At 150ms roughly 8% of typed queries still end stale.',
    },
    {
      id: 'd4', question: 'A colleague suggests raising the debounce to 400ms instead. What do you say?',
      options: [
        'Agree — the bug stops reproducing',
        'It closes on your network and reopens on a slow one',
        'It is fine if we add a spinner',
        'Only if the endpoint is cached',
      ],
      correct: 1,
      why: 'The race window is a ratio to a latency tail you do not control. Under 1% at p95 600ms; back to roughly 10% at p95 1500ms — with a search box that now feels slow.',
    },
    {
      id: 'd5', question: 'Where does the guard go?',
      options: ['On the input', 'Inside the request', 'On the edge between the response and the list', 'In the cache'],
      correct: 2,
      why: 'The failure is a superseded response reaching the list. The edge where it would arrive is the only place that can stop it.',
    },
    {
      id: 'd6', question: 'Sequence guard or AbortController?',
      options: [
        'Sequencing — it fixes what is rendered',
        'Abort — it fixes what is spent',
        'Either; say which cost you are paying',
        'Neither; retry instead',
      ],
      correct: 2,
      why: 'They solve different problems. Sequencing is four lines with no failure mode of its own, so it ships first; abort additionally saves bandwidth, with the caveat that cancel is not undo.',
    },
  ],

  ledger: [
    {
      id: 'l1', decision: 'Request volume', chose: 'Trailing debounce, ~150ms',
      rejected: 'One request per keystroke',
      flipsWhen: 'The endpoint becomes free and instant, at which point the debounce only adds latency.',
    },
    {
      id: 'l2', decision: 'Response ordering', chose: 'Monotonic sequence guard',
      rejected: 'A longer debounce',
      flipsWhen: 'Results must be merged rather than replaced — then newest-wins discards data and the guard has to be per-item.',
    },
    {
      id: 'l3', decision: 'Wasted work', chose: 'Ship sequencing first, abort second',
      rejected: 'AbortController alone',
      flipsWhen: 'Bandwidth is the binding constraint before correctness is — a metered connection with a cheap, idempotent endpoint.',
    },
  ],

  subsystems: [
    { id: 's1', label: 'The response guard', focus: 'What stands between a response and the DOM, and what happens to the one it rejects?' },
    { id: 's2', label: 'The request policy', focus: 'How many requests does a typed query make, and what decides that number?' },
  ],

  structureTags: ['unbounded-stream', 'bounded-surface', 'edge-guard', 'ordering', 'latency-tail'],
  independentPartner: 'cs-log-tail',
  canvasKey,
}
export default spec
