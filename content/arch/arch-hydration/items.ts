import type { Item } from '../../types'

/** Verb is `diagnose`, so the auto-graded judgment items here DO move Mastery. */
const items: Item[] = [
  {
    id: 'arch-hydration-i2', kind: 'predict', primaryClaim: 'arch-hydration-c2',
    prompt: 'You migrate a dashboard from CSR to SSR. What happens to TTFB?',
    payload: {
      control: 'binary-with-margin',
      options: ['it improves', 'it gets worse'], correct: 'it gets worse',
      whyPlausible: {
        'it improves': '"SSR is faster" is about first CONTENT, not first byte. The server now waits on data before it can send anything, so the first byte arrives later than it did with an empty shell.',
      },
    },
  },
  { id: 'arch-hydration-i1', kind: 'mcq-rationale', primaryClaim: 'arch-hydration-c1',
    prompt: 'Why does CSR have the best TTFB of the five strategies?',
    payload: {
      options: ['The bundle is cached', 'The server does no per-request work', 'It uses a CDN', 'HTTP/2 multiplexing'],
      correct: 1,
      rationales: ['Because repeat visits skip the download', 'Because there is nothing to wait for before the first byte — which is also why the screen is empty', 'Because static assets are edge-cached', 'Because parallel requests'],
      correctRationale: 1,
    } },
  { id: 'arch-hydration-i5', kind: 'claim-recall', primaryClaim: 'arch-hydration-c1',
    prompt: 'What does CSR buy with its excellent TTFB, and what does it pay?' },
  { id: 'arch-hydration-i6', kind: 'constraint-flip', primaryClaim: 'arch-hydration-c2',
    prompt: 'You switch from SSR to streaming SSR, flushing the shell before the data resolves. Which way does TTFB move?',
    payload: { direction: 'down', bands: ['back to CSR levels', 'slightly better', 'unchanged'], correctBand: 0,
      flipParameter: 'whether the server waits on data before the first flush' } },
  { id: 'arch-hydration-i9', kind: 'spot-the-failure', primaryClaim: 'arch-hydration-c2',
    prompt: 'A team migrates to SSR "for performance" and LCP improves while TTFB regresses. Where is the misunderstanding?',
    payload: {
      regions: ['conflating first byte with first content', 'a slow database', 'a CDN misconfiguration'],
      classes: ['a metric conflation', 'an infrastructure fault', 'a caching bug'],
      hitRegion: 'conflating first byte with first content', failureClass: 'a metric conflation',
      adjacentHint: 'That would make it worse too — but the regression here is structural, not a fault.',
    } },
  { id: 'arch-hydration-i3', kind: 'mcq-rationale', primaryClaim: 'arch-hydration-c3',
    prompt: 'You wrap slow sections in Suspense and stream them. What happens to time-to-interactive?',
    payload: {
      options: ['It improves proportionally', 'It is largely unchanged', 'It gets worse', 'It becomes zero'],
      correct: 1,
      rationales: ['Because content arrives sooner', 'Because the same client JavaScript must still download, parse and reattach — streaming moved when things arrive, not how much work there is', 'Because streaming adds overhead', 'Because the server rendered it'],
      correctRationale: 1,
    } },
  { id: 'arch-hydration-i7', kind: 'cloze', primaryClaim: 'arch-hydration-c3',
    prompt: 'Streaming ______ hydration work; it does not ______ it.',
    payload: { blanks: ['re-orders', 'shorten'], accept: { 0: ['re-orders', 'reorders', 'moves', 'delays'], 1: ['shorten', 'reduce', 'remove'] } } },
  { id: 'arch-hydration-i4', kind: 'constraint-flip', primaryClaim: 'arch-hydration-c4',
    prompt: 'Your page is a spreadsheet where nearly every cell is interactive. Does moving to RSC reduce the client bundle?',
    payload: { direction: 'no', bands: ['barely — almost everything is a client component', 'yes, substantially'], correctBand: 0,
      flipParameter: 'how much of the tree is genuinely static' } },
  { id: 'arch-hydration-i8', kind: 'cloze', primaryClaim: 'arch-hydration-c4',
    prompt: 'Islands and RSC reduce the JavaScript before interaction because most of the tree never becomes a ______ ______ at all.',
    payload: { blanks: ['client', 'component'], accept: { 0: ['client'], 1: ['component'] } } },
  { id: 'arch-hydration-i10', kind: 'claim-recall', primaryClaim: 'arch-hydration-c5',
    prompt: 'What ongoing cost does every per-request rendering strategy commit a team to?' },
]
export default items
