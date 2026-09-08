import type { Item } from '../../types'

/** Verb is `judge`, so the auto-graded judgment items here DO move Mastery. */
const items: Item[] = [
  {
    id: 'state-taxonomy-i2', kind: 'predict', primaryClaim: 'state-taxonomy-c2',
    prompt: 'A dashboard fetches unreadCount once into a global store, read by the sidebar and the header. Which breaks FIRST in production: (a) sidebar and header disagree, (b) stale after another tab marks messages read, (c) wrong after reload?',
    payload: { control: 'binary-with-margin', correct: 'b', whyPlausible: { a: 'One store is exactly what prevents disagreement — that failure was designed out the moment the value moved into the store.', c: 'A reload re-runs the fetch, so the value is fresh again; reload is the one thing that accidentally fixes it.' } },
  },
  { id: 'state-taxonomy-i6', kind: 'mcq-rationale', primaryClaim: 'state-taxonomy-c2',
    prompt: 'Which change actually fixes the stale unread count?',
    payload: { options: ['Move it into Redux instead of Zustand', 'Give it a freshness policy and revalidate on focus', 'Put it in the URL', 'Lift it to a shared parent'], correct: 1,
      rationales: ['Because the library was the problem', 'Because staleness is a freshness question, and only a cache answers it', 'Because the URL survives reload', 'Because a common ancestor makes it consistent'], correctRationale: 1 } },
  { id: 'state-taxonomy-i8', kind: 'constraint-flip', primaryClaim: 'state-taxonomy-c2',
    prompt: 'The value can now only ever change in this tab, in response to this user. Does the global store become sufficient?',
    payload: { direction: 'yes', bands: ['sufficient', 'still insufficient'], correctBand: 0, flipParameter: 'who can change the value' } },
  { id: 'state-taxonomy-i1', kind: 'mcq-rationale', primaryClaim: 'state-taxonomy-c1',
    prompt: 'Sidebar and header show different unread counts. What is the defect?',
    payload: { options: ['A race between two fetches', 'Two owners of one truth', 'A caching bug', 'A re-render ordering bug'], correct: 1,
      rationales: ['Because the requests resolved out of order', 'Because the value has no single owner, so nothing keeps the copies equal', 'Because a cache went stale', 'Because React batched the updates differently'], correctRationale: 1 } },
  { id: 'state-taxonomy-i5', kind: 'claim-recall', primaryClaim: 'state-taxonomy-c1',
    prompt: 'When are two separate copies of a value correct rather than a bug?' },
  { id: 'state-taxonomy-i3', kind: 'constraint-flip', primaryClaim: 'state-taxonomy-c3',
    prompt: 'The product now requires that a filtered dashboard view can be pasted into Slack and open identically. Where must the filter state live?',
    payload: { direction: 'url', bands: ['component', 'client store', 'the URL', 'server cache'], correctBand: 2, flipParameter: 'shareability' } },
  { id: 'state-taxonomy-i7', kind: 'cloze', primaryClaim: 'state-taxonomy-c3',
    prompt: 'The URL survives ______ and is ______ by link, but it never ______.',
    payload: { blanks: ['reload', 'shareable', 'revalidates'], accept: { 0: ['reload', 'refresh'], 1: ['shareable', 'sharable'], 2: ['revalidates', 'refetches', 'refreshes'] } } },
  { id: 'state-taxonomy-i4', kind: 'spot-the-failure', primaryClaim: 'state-taxonomy-c4',
    prompt: 'Click the placement whose staleness column stays red no matter which library backs it.',
    payload: { hitRegion: 'client-store:staleAfterExternalChange', failureClass: 'no-freshness-policy', adjacentHint: 'Close — that row also fails, but for a different reason: it never had a single owner to begin with.' } },
  { id: 'state-taxonomy-i9', kind: 'claim-recall', primaryClaim: 'state-taxonomy-c4',
    prompt: 'What two questions define a freshness policy?' },
  { id: 'state-taxonomy-i10', kind: 'claim-recall', primaryClaim: 'state-taxonomy-c5',
    prompt: 'An interviewer asks "how would you manage this state?" — what must you establish before naming any library?' },
]
export default items
