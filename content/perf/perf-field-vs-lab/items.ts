import type { Item } from '../../types'

/** Verb is `judge`, so the auto-graded judgment items here DO move Mastery. */
const items: Item[] = [
  {
    id: 'perf-field-vs-lab-i1', kind: 'predict', primaryClaim: 'perf-field-vs-lab-c1', secondaryClaim: 'perf-field-vs-lab-c2',
    prompt: 'Field LCP is median 2.2s / p95 6.2s. You ship a fix that saves 700ms, but only on sessions already under 2.5s. By how many milliseconds does p75 improve?',
    payload: {
      control: 'point', correct: 0, unit: 'ms', tolerance: { abs: 60 },
      whyPlausible: {
        high: 'You are reasoning from how much the fix saves per session — but p75 sits out past the cutoff, in the part of the distribution the fix never touches.',
        low: 'Close. The honest answer is exactly zero: not "a little", none at all.',
      },
    },
  },
  { id: 'perf-field-vs-lab-i5', kind: 'mcq-rationale', primaryClaim: 'perf-field-vs-lab-c1',
    prompt: 'Your Lighthouse score is 98 and field LCP is failing. What is the most likely explanation?',
    payload: {
      options: ['Lighthouse is misconfigured', 'The lab measures one fast, warm, scripted load', 'The field data is stale', 'A third-party script only loads in production'],
      correct: 1,
      rationales: [
        'Because a score that high must be wrong',
        'Because a single point on a fast machine says nothing about the spread of real devices, networks and cache states',
        'Because CrUX lags',
        'Because production differs from the lab environment',
      ],
      correctRationale: 1,
    } },
  { id: 'perf-field-vs-lab-i6', kind: 'constraint-flip', primaryClaim: 'perf-field-vs-lab-c2',
    prompt: 'Instead of helping fast sessions, the fix removes a render-blocking request that only slow connections wait on. Which way does p75 move, and into which band?',
    payload: { direction: 'down', bands: ['0ms', '1-200ms', '200-800ms', '>800ms'], correctBand: 2,
      flipParameter: 'whether the fix touches sessions at or above the 75th percentile' } },
  { id: 'perf-field-vs-lab-i9', kind: 'spot-the-failure', primaryClaim: 'perf-field-vs-lab-c2',
    prompt: 'A team reports "30% faster" and the vitals dashboard is unchanged. Where did the improvement land?',
    payload: {
      regions: ['in the fast half of the distribution', 'at the 75th percentile', 'in the tail'],
      classes: ['optimised a percentile nobody grades', 'measurement error', 'a regression elsewhere'],
      hitRegion: 'in the fast half of the distribution', failureClass: 'optimised a percentile nobody grades',
      adjacentHint: 'Close — but if the gain had landed there, p75 would have moved. It did not.',
    } },
  { id: 'perf-field-vs-lab-i3', kind: 'mcq-rationale', primaryClaim: 'perf-field-vs-lab-c3',
    prompt: 'Which Core Web Vital can Lighthouse not report at all?',
    payload: {
      options: ['LCP', 'CLS', 'INP', 'TTFB'],
      correct: 2,
      rationales: ['Because it needs a real viewport', 'Because layout shifts need a real session', 'Because it is defined over real interactions, and a scripted load performs none', 'Because it is a server metric'],
      correctRationale: 2,
    } },
  { id: 'perf-field-vs-lab-i7', kind: 'cloze', primaryClaim: 'perf-field-vs-lab-c3',
    prompt: 'Lighthouse ______ measure ______ at all, because it is defined over real interactions across a session.',
    payload: { blanks: ['cannot', 'INP'], accept: { 0: ['cannot', 'no', 'not measured', "can't"], 1: ['inp'] } } },
  { id: 'perf-field-vs-lab-i4', kind: 'constraint-flip', primaryClaim: 'perf-field-vs-lab-c4',
    prompt: 'You deployed the fix yesterday and CrUX has not moved. Has the fix failed?',
    payload: { direction: 'no', bands: ['no — the window has not caught up', 'yes — it would show by now'], correctBand: 0,
      flipParameter: 'the 28-day rolling window' } },
  { id: 'perf-field-vs-lab-i8', kind: 'cloze', primaryClaim: 'perf-field-vs-lab-c4',
    prompt: 'CrUX grades on a rolling ______-day window, so your own ______ is what tells you whether a deploy worked this week.',
    payload: { blanks: ['28', 'RUM'], accept: { 0: ['28', 'twenty-eight'], 1: ['rum', 'real user monitoring', 'field data'] } } },
  { id: 'perf-field-vs-lab-i2', kind: 'cloze', primaryClaim: 'perf-field-vs-lab-c2',
    prompt: 'Core Web Vitals are graded at the ______ percentile, so a fix that only helps the ______ can move the score by nothing.',
    payload: { blanks: ['75th', 'median'], accept: { 0: ['75th', '75', 'p75'], 1: ['median', 'average', 'fast half'] } } },
]
export default items
