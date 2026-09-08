import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'perf-field-vs-lab',
  status: 'drafted',
  figure: {
    id: 'perf-field-vs-lab-fig1',
    question: 'The fix saves 700ms on every session it touches — how much does p75 move?',
    primitive: 'Plot2D',
    control: 'point',
  },
  sources: [
    { title: 'Core Web Vitals thresholds — web.dev', url: 'https://web.dev/articles/defining-core-web-vitals-thresholds', note: 'Why the 75th percentile, and what "good" means at it.' },
    { title: 'CrUX methodology', url: 'https://developer.chrome.com/docs/crux/methodology', note: 'The rolling 28-day window, and what it can and cannot tell you about a recent deploy.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
