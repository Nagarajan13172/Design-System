import type { Claim } from '../../types'

const claims: Claim[] = [
  {
    id: 'arch-hydration-c1',
    assertion: 'CSR has the best TTFB of any strategy precisely because the server does no work — the cost is that nothing is on screen until the bundle arrives and runs.',
    evidence: 'derivation',
    flipCondition: 'On a fast connection with a warm cache the gap closes, which is exactly why it looks fine on a developer machine.',
    misconception: 'CSR is slow.',
    conceptTokens: [['ttfb', 'first byte'], ['no work', 'nothing', 'empty shell'], ['bundle', 'javascript', 'js']],
    probes: ['arch-hydration-i1', 'arch-hydration-i5'],
  },
  {
    id: 'arch-hydration-c2',
    assertion: 'SSR makes TTFB worse, not better: the server fetches data before sending a byte, so it trades time-to-first-byte for time-to-first-content.',
    evidence: 'measurement',
    flipCondition: 'Streaming SSR flushes the shell before the data resolves, which recovers TTFB while keeping content in the HTML.',
    misconception: 'SSR is faster than CSR.',
    conceptTokens: [['ttfb', 'first byte'], ['worse', 'slower', 'increases'], ['trade', 'trades', 'exchange'], ['content', 'first paint', 'markup']],
    probes: ['arch-hydration-i2', 'arch-hydration-i6', 'arch-hydration-i9'],
  },
  {
    id: 'arch-hydration-c3',
    assertion: 'Streaming re-orders hydration work; it does not shorten it. The page is still not interactive until the same JavaScript has downloaded, parsed and reattached every handler.',
    evidence: 'measurement',
    flipCondition: 'Only reducing the amount of client JavaScript shortens it — moving when it arrives cannot.',
    misconception: 'Suspense and streaming make the page faster.',
    conceptTokens: [['re-order', 'reorder', 'moves', 'when'], ['not', 'does not', 'never'], ['shorten', 'reduce', 'less'], ['hydration', 'hydrate', 'interactive']],
    probes: ['arch-hydration-i3', 'arch-hydration-i7'],
  },
  {
    id: 'arch-hydration-c4',
    assertion: 'Islands and RSC are the only strategies that reduce the JavaScript needed before interaction, because most of the tree never becomes a client component at all.',
    evidence: 'measurement',
    flipCondition: 'A page where almost everything is genuinely interactive gets no benefit — the boundary only helps where there is static tree to leave behind.',
    misconception: 'RSC is just SSR with better ergonomics.',
    conceptTokens: [['islands', 'rsc', 'server components'], ['reduce', 'less', 'smaller'], ['client component', 'boundary', 'tree']],
    probes: ['arch-hydration-i4', 'arch-hydration-i8'],
  },
  {
    id: 'arch-hydration-c5',
    assertion: 'Every per-request strategy buys its wins with a server you must operate forever, which is a real cost paid by a team rather than by a metric.',
    evidence: 'authored-heuristic',
    conceptTokens: [['server', 'infrastructure', 'operate'], ['forever', 'ongoing', 'maintain'], ['team', 'cost', 'operational']],
    probes: ['arch-hydration-i10'],
  },
]
export default claims
