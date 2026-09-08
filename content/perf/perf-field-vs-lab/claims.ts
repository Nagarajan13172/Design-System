import type { Claim } from '../../types'

const claims: Claim[] = [
  {
    id: 'perf-field-vs-lab-c1',
    assertion: 'A lab score measures one scripted load on one machine, so it reports a single point while the field reports a distribution — and the two disagree most where it matters, in the tail.',
    evidence: 'measurement',
    flipCondition: 'If every real session used the same device, network and cache state as the lab run, the point and the distribution would coincide.',
    misconception: 'Our Lighthouse score is 98, so real users are fine.',
    conceptTokens: [['lab', 'lighthouse', 'synthetic'], ['field', 'rum', 'real users'], ['distribution', 'spread', 'tail'], ['single', 'one', 'point']],
    probes: ['perf-field-vs-lab-i1', 'perf-field-vs-lab-i5'],
  },
  {
    id: 'perf-field-vs-lab-c2',
    assertion: 'Core Web Vitals are graded at the 75th percentile of real sessions, so a fix that helps only already-fast sessions can improve the median by 700ms and move p75 by exactly zero.',
    evidence: 'measurement',
    flipCondition: 'A change that compresses the tail improves p75 even if the median does not move at all.',
    misconception: 'We cut average load time by 30%, so our vitals will improve.',
    conceptTokens: [['p75', '75th', 'percentile'], ['median', 'average', 'mean'], ['tail', 'slow sessions'], ['no', 'nothing', 'unchanged']],
    probes: ['perf-field-vs-lab-i2', 'perf-field-vs-lab-i6', 'perf-field-vs-lab-i9'],
  },
  {
    id: 'perf-field-vs-lab-c3',
    assertion: 'Lighthouse cannot measure INP at all, because INP is defined over real interactions across a session and a scripted load performs none.',
    evidence: 'specification',
    flipCondition: 'A scripted user-flow run with real interactions can approximate it, but it is still one device and one script.',
    misconception: 'Lighthouse gives us all three Core Web Vitals.',
    conceptTokens: [['inp'], ['interaction', 'real user', 'session'], ['cannot', 'no', 'not measured']],
    probes: ['perf-field-vs-lab-i3', 'perf-field-vs-lab-i7'],
  },
  {
    id: 'perf-field-vs-lab-c4',
    assertion: 'CrUX grades a site on a rolling 28-day window, so a fix deployed today does not show a settled field number for weeks — and reading the dashboard sooner reads mostly the old build.',
    evidence: 'specification',
    flipCondition: 'Your own RUM has no such lag, which is the reason to collect it even when CrUX is available.',
    misconception: 'We shipped the fix yesterday and CrUX has not moved, so the fix did not work.',
    conceptTokens: [['crux', 'chrome ux report'], ['28', 'rolling', 'window'], ['lag', 'weeks', 'delay']],
    probes: ['perf-field-vs-lab-i4', 'perf-field-vs-lab-i8'],
  },
]
export default claims
