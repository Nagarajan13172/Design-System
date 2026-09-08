import type { DefencePrompt } from '../../../src/domain/articulation/types'

/**
 * The trade-off this module actually turns on. Note there is no "it depends"
 * option — the escape hatch is naming the parameter, which is the thing an
 * interviewer is listening for anyway.
 */
const defence: DefencePrompt = {
  id: 'state-races-d1',
  moduleId: 'state-races',
  claimId: 'state-races-c4',
  situation:
    'A typeahead fires a request per typing pause. Occasionally the results shown are for a query the user has already replaced. ' +
    'You have two guards available and time to ship one this week.',
  question: 'A monotonic sequence guard, or AbortController on every keystroke?',
  options: [
    { id: 'seq', label: 'Sequence guard — drop any response that is not the newest' },
    { id: 'abort', label: 'AbortController — cancel the previous request on every keystroke', flipParameter: 'bandwidth and server cost on mobile' },
    { id: 'both', label: 'Both, sequencing first', flipParameter: 'how much time you have to ship' },
  ],
  criteria: [
    {
      id: 'ordering',
      label: 'Distinguishes arrival order from dispatch order',
      conceptTokens: [['order', 'ordering'], ['arrive', 'arrival'], ['dispatch', 'issue', 'sent', 'fired']],
      anchors: {
        weak: 'Says responses can come back late.',
        adequate: 'Says the last response to arrive is not necessarily the response to the last request.',
        strong: 'Names the condition: one response overtakes another when its latency exceeds the inter-dispatch gap plus the next response’s latency.',
      },
    },
    {
      id: 'silent',
      label: 'Notes that the failure is silent',
      conceptTokens: [['silent', 'no error', 'not an error', 'invisible'], ['success', 'succeed', '200']],
      anchors: {
        weak: 'Says it is a bug.',
        adequate: 'Says nothing errors — every request returned 200.',
        strong: 'Draws the consequence: it cannot be seen in error tracking, so it needs a signal comparing the response to the current input.',
      },
    },
    {
      id: 'separation',
      label: 'Separates what is rendered from what is spent',
      conceptTokens: [['render', 'rendered', 'display', 'shown'], ['bandwidth', 'bytes', 'wasted', 'cost']],
      anchors: {
        weak: 'Says one is better than the other.',
        adequate: 'Says abort saves bandwidth and sequencing fixes correctness.',
        strong: 'States they solve different problems, so the choice is about which cost you are paying this week — not which is correct.',
      },
    },
    {
      id: 'abort-limits',
      label: 'Knows what abort does not do',
      conceptTokens: [['abort', 'cancel'], ['server', 'backend'], ['effect', 'already', 'still', 'arrived']],
      anchors: {
        weak: 'Says abort cancels the request.',
        adequate: 'Says abort stops the client listening, not the server working.',
        strong: 'Draws the consequence for writes: an aborted mutation may already have committed, so cancel is not undo.',
      },
    },
  ],
  modelAnswer:
    'Sequencing fixes what is RENDERED; cancellation fixes what is SPENT. They solve different problems, so the ' +
    'question is which cost you are paying, not which is correct. Sequencing is four lines, has no failure mode of ' +
    'its own, and closes the correctness bug outright — so it ships first. Cancellation is a genuine second win on ' +
    'mobile, with the caveat that aborting severs the client’s interest in a response and not the server’s work: for ' +
    'anything with side effects, cancel is not undo.',
}
export default defence
