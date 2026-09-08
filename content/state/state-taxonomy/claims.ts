import type { Claim } from '../../types'

const claims: Claim[] = [
  {
    id: 'state-taxonomy-c1',
    assertion: 'Two components that each fetch their own copy of one server value can disagree, because there is no single owner of that truth — the bug is placement, not fetching.',
    evidence: 'derivation',
    flipCondition: 'If the value were genuinely per-component (a hover state, an open/closed flag), separate copies would be correct rather than a bug.',
    conceptTokens: [['owner', 'ownership', 'single', 'one copy'], ['disagree', 'diverge', 'inconsistent'], ['placement', 'where', 'lives']],
    probes: ['state-taxonomy-i1', 'state-taxonomy-i5'],
  },
  {
    id: 'state-taxonomy-c2',
    assertion: 'Moving server data into a global client store fixes component disagreement and remount loss but not staleness — so it solves the two failures that were not happening and leaves the one that was.',
    evidence: 'measurement',
    flipCondition: 'If the value could only ever change in this tab, in response to this user, a client store would be sufficient.',
    conceptTokens: [['store', 'global', 'zustand', 'redux'], ['stale', 'staleness', 'freshness'], ['does not', 'not fixed', 'still', 'leaves']],
    probes: ['state-taxonomy-i2', 'state-taxonomy-i6', 'state-taxonomy-i8'],
  },
  {
    id: 'state-taxonomy-c3',
    assertion: 'The URL is state: it survives reload and is shareable by link, which is why filters, tabs and pagination belong there — but it never revalidates, so server-owned values do not.',
    evidence: 'measurement',
    flipCondition: 'A value that must NOT be shareable — a draft, a token, a scroll position — belongs anywhere but the URL.',
    conceptTokens: [['url', 'query', 'search param'], ['shareable', 'link', 'reload'], ['filter', 'tab', 'pagination', 'sort']],
    probes: ['state-taxonomy-i3', 'state-taxonomy-i7'],
  },
  {
    id: 'state-taxonomy-c4',
    assertion: 'Server data is a cache with an explicit freshness policy, not application state: the question to answer is how long it may be wrong and what makes it right again.',
    evidence: 'measurement',
    flipCondition: 'Data the client alone owns and originates — an unsent draft, a local sort order — is genuinely application state and has no freshness policy.',
    conceptTokens: [['cache', 'caching'], ['freshness', 'stale', 'revalidate', 'invalidate'], ['how long', 'policy', 'window']],
    probes: ['state-taxonomy-i4', 'state-taxonomy-i9'],
  },
  {
    id: 'state-taxonomy-c5',
    assertion: 'Choosing a state library before deciding who owns the truth answers the wrong question: nearly every bug in this area is a placement mistake wearing a library’s costume.',
    evidence: 'authored-heuristic',
    conceptTokens: [['library', 'redux', 'zustand', 'tool'], ['placement', 'ownership', 'who owns'], ['wrong question', 'before', 'first']],
    probes: ['state-taxonomy-i10'],
  },
]
export default claims
