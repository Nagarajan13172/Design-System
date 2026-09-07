import type { Claim } from '../../types'

/**
 * Atomic, checkable, and each one stands alone — because that is how it is shown
 * in an interleaved review deck three weeks from now, with no surrounding prose.
 *
 * Every `measurement` claim below is asserted against sim.ts in sim.test.ts. The
 * numbers were measured first and written second; none of them was invented.
 */
const claims: Claim[] = [
  {
    id: 'state-races-c1',
    assertion: 'Two requests dispatched in order can arrive in either order, so the last response to arrive is not necessarily the response to the last request.',
    evidence: 'derivation',
    flipCondition: 'If the transport guaranteed in-order delivery per connection AND the server processed serially, arrival order would match dispatch order.',
    conceptTokens: [['order', 'sequence', 'ordering'], ['arrive', 'arrival', 'complete', 'completion'], ['dispatch', 'issue', 'sent', 'fired']],
    probes: ['state-races-i1', 'state-races-i7', 'state-races-i12'],
  },
  {
    id: 'state-races-c2',
    assertion: 'A stale final render is not an error state: every request succeeded, nothing is logged, and the UI simply shows results for a query the user already replaced.',
    evidence: 'derivation',
    flipCondition: 'If the client compared the response to the current input before rendering, the mismatch would become detectable rather than silent.',
    conceptTokens: [['silent', 'invisible', 'no error', 'not an error'], ['success', 'succeeded', '200'], ['stale', 'outdated', 'previous']],
    probes: ['state-races-i2', 'state-races-i8'],
  },
  {
    id: 'state-races-c3',
    assertion: 'Debouncing shrinks the race window but cannot close it: a race survives whenever one response’s latency exceeds the gap between dispatches plus the next response’s latency.',
    evidence: 'measurement',
    flipCondition: 'If the debounce interval exceeded the p100 response latency, no two requests could ever be in flight together — at the cost of a UI that feels broken.',
    conceptTokens: [['debounce', 'debouncing'], ['window', 'gap', 'interval'], ['shrink', 'reduce', 'narrow', 'smaller'], ['not', 'never', 'cannot', 'does not']],
    probes: ['state-races-i3', 'state-races-i9', 'state-races-i13'],
  },
  {
    id: 'state-races-c4',
    assertion: 'A monotonic request sequence number — drop any response that is not the newest — eliminates stale final renders without cancelling a single request.',
    evidence: 'measurement',
    flipCondition: 'If responses had to be merged rather than replaced (an append-only feed), newest-wins would discard data and the guard would need to be per-item instead.',
    conceptTokens: [['sequence', 'monotonic', 'counter', 'generation', 'version'], ['drop', 'discard', 'ignore'], ['newest', 'latest', 'current']],
    probes: ['state-races-i4', 'state-races-i10', 'state-races-i14'],
  },
  {
    id: 'state-races-c5',
    assertion: 'AbortController cancels the client’s interest in a response, not the server’s work: the request may already have arrived and had effects.',
    evidence: 'specification',
    flipCondition: 'If the endpoint were idempotent and read-only, the distinction would cost nothing but wasted bandwidth.',
    conceptTokens: [['abort', 'abortcontroller', 'cancel', 'cancellation'], ['server', 'backend'], ['effect', 'side effect', 'already', 'still']],
    probes: ['state-races-i5', 'state-races-i11'],
  },
  {
    id: 'state-races-c6',
    assertion: 'The same 300ms debounce leaves roughly 1% of sessions ending on stale data at p95 latency 480ms and roughly 13% at p95 1500ms, so a race bug that looks fixed on a fast network reappears an order of magnitude more often in the field.',
    evidence: 'measurement',
    flipCondition: 'If field p95 latency were below the inter-dispatch gap, the stale rate would fall to zero and the debounce would genuinely be sufficient.',
    conceptTokens: [['p95', 'tail', 'percentile', 'slow'], ['field', 'production', 'real users'], ['debounce'], ['worse', 'more', 'higher', 'order of magnitude']],
    probes: ['state-races-i6', 'state-races-i9'],
  },
]
export default claims
