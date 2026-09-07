import type { Claim } from '../../types'

/**
 * 4-8 ATOMIC claims. Each must stand alone out of context — that is how it will be
 * shown in an interleaved deck three weeks from now.
 *
 * Write `measurement` claims LAST: measure with the sim first, then state the number
 * you measured. Never state a number and then try to make the sim produce it.
 */
const claims: Claim[] = [
  {
    id: '__ID__-c1',
    assertion: '__ONELINER__',
    evidence: 'derivation',
    flipCondition: 'TODO: what would make this false?',
    conceptTokens: [['TODO']],
    probes: ['__ID__-i1'],
  },
]
export default claims
