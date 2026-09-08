import type { Item } from '../../types'

/** Verb is `design`, so the auto-graded judgment items here DO move Mastery. */
const items: Item[] = [
  {
    id: 'cs-autocomplete-i3', kind: 'predict', primaryClaim: 'cs-autocomplete-c3',
    prompt: 'The typeahead shows stale results about 8% of the time with a 150ms debounce. A colleague raises it to 400ms and the bug stops reproducing. Is it fixed?',
    payload: {
      control: 'binary-with-margin',
      options: ['yes — the rate is under 1%', 'no — it comes back on a slower network'],
      correct: 'no — it comes back on a slower network',
      whyPlausible: {
        'yes — the rate is under 1%': 'On your machine it genuinely is under 1%, which is exactly why this ships. The race window is a ratio to the latency tail — at a p95 of 1500ms the same build is back around 10%.',
      },
    },
  },
  { id: 'cs-autocomplete-i1', kind: 'cloze', primaryClaim: 'cs-autocomplete-c1',
    prompt: 'A trailing debounce is a cost control on request ______; it does not change what is ______.',
    payload: { blanks: ['volume', 'rendered'], accept: { 0: ['volume', 'count', 'rate'], 1: ['rendered', 'displayed', 'shown'] } } },
  { id: 'cs-autocomplete-i5', kind: 'claim-recall', primaryClaim: 'cs-autocomplete-c1',
    prompt: 'What does a debounce actually buy you here?' },
  { id: 'cs-autocomplete-i2', kind: 'spot-the-failure', primaryClaim: 'cs-autocomplete-c2',
    prompt: 'Users report the typeahead "sometimes shows the wrong thing" and your dashboards are clean. Where would you look?',
    payload: {
      regions: ['a counter comparing response query to current input', 'the error rate', 'p95 latency'],
      classes: ['a correctness failure with no error condition', 'an outage', 'a performance regression'],
      hitRegion: 'a counter comparing response query to current input',
      failureClass: 'a correctness failure with no error condition',
      adjacentHint: 'Latency is the cause, but it looks normal — the session that breaks contains one unusually FAST response.',
    } },
  { id: 'cs-autocomplete-i6', kind: 'constraint-flip', primaryClaim: 'cs-autocomplete-c2',
    prompt: 'You remove the debounce entirely and fire on every keystroke. Which band does the stale rate land in?',
    payload: { direction: 'up', bands: ['<2%', '2-10%', '10-25%', '>25%'], correctBand: 3,
      flipParameter: 'the gap between dispatches' } },
  { id: 'cs-autocomplete-i7', kind: 'constraint-flip', primaryClaim: 'cs-autocomplete-c3',
    prompt: 'Same 400ms debounce, but your users move from office wifi (p95 600ms) to a train (p95 1500ms). Which band?',
    payload: { direction: 'up', bands: ['<2%', '2-10%', '10-25%', '>25%'], correctBand: 2,
      flipParameter: 'p95 latency relative to the inter-dispatch gap' } },
  { id: 'cs-autocomplete-i4', kind: 'mcq-rationale', primaryClaim: 'cs-autocomplete-c4',
    prompt: 'Where does the guard belong in the design?',
    payload: {
      options: ['Before the debounce', 'Between the response and the list', 'Inside the request', 'On the input'],
      correct: 1,
      rationales: [
        'Because fewer requests means fewer races',
        'Because the failure is a response reaching the list after a newer one — that edge is where it must be stopped',
        'Because the request knows its own query',
        'Because the input is the source of truth',
      ],
      correctRationale: 1,
    } },
  { id: 'cs-autocomplete-i8', kind: 'claim-recall', primaryClaim: 'cs-autocomplete-c4',
    prompt: 'Why does the design put a guard on the edge rather than tune the debounce?' },
]
export default items
