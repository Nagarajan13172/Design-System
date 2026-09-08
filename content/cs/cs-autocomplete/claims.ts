import type { Claim } from '../../types'

/**
 * This case study cashes in `state-races`. Its claims are about the DESIGN
 * decision, not the mechanism — the mechanism is the module's job, and repeating it
 * here would be the duplicate-claim problem the one-owner lint exists to catch.
 */
const claims: Claim[] = [
  {
    id: 'cs-autocomplete-c1',
    assertion: 'A trailing debounce is a cost control on request volume: at 150ms it cuts a typed query from one request per keystroke to about seven, and that is the whole of what it buys.',
    evidence: 'measurement',
    flipCondition: 'If the endpoint were free and instant, the debounce would buy nothing at all.',
    misconception: 'Debouncing is how you fix a typeahead.',
    conceptTokens: [['debounce'], ['volume', 'requests', 'cost'], ['not', 'does not', 'only']],
    probes: ['cs-autocomplete-i1', 'cs-autocomplete-i5'],
  },
  {
    id: 'cs-autocomplete-c2',
    assertion: 'With a 150ms debounce and no guard, about 8% of typed queries end with the list showing results for a query no longer in the box — and nothing errors, so no dashboard shows it.',
    evidence: 'measurement',
    flipCondition: 'A guard on the response takes it to zero without changing the debounce at all.',
    conceptTokens: [['stale', 'no longer', 'replaced'], ['silent', 'no error', 'nothing errors']],
    probes: ['cs-autocomplete-i2', 'cs-autocomplete-i6'],
  },
  {
    id: 'cs-autocomplete-c3',
    assertion: 'Raising the debounce to 400ms drops the stale rate to under 1% on a fast network and back to roughly 10% at a p95 of 1500ms: the fix that passes review is the one that fails in the field.',
    evidence: 'measurement',
    flipCondition: 'If your users’ latency tail were genuinely bounded, a large debounce would be sufficient — it is the tail you do not control that reopens it.',
    misconception: 'We tuned the debounce until the bug went away.',
    conceptTokens: [['debounce'], ['network', 'latency', 'tail', 'p95'], ['reopen', 'back', 'returns', 'again']],
    probes: ['cs-autocomplete-i3', 'cs-autocomplete-i7'],
  },
  {
    id: 'cs-autocomplete-c4',
    assertion: 'A guard between the response and the list takes the stale rate to zero at every latency profile, which is why the design puts one there rather than tuning a number.',
    evidence: 'measurement',
    flipCondition: 'If results had to be merged rather than replaced, newest-wins would discard data and the guard would need to be per-item.',
    conceptTokens: [['guard', 'sequence', 'cancel', 'abort'], ['zero', 'none', 'eliminates'], ['every', 'all', 'any latency']],
    probes: ['cs-autocomplete-i4', 'cs-autocomplete-i8'],
  },
]
export default claims
