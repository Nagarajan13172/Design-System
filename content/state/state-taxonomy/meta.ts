import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'state-taxonomy',
  status: 'drafted',
  figure: {
    id: 'state-taxonomy-fig1',
    question: 'Which of the three failures fires first in production?',
    primitive: 'StateMatrix',
    control: 'binary-with-margin',
  },
  sources: [
    { title: 'HTTP caching — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching', note: 'Freshness as an explicit policy rather than an implicit hope.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
