import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'cs-autocomplete',
  status: 'drafted',
  figure: {
    id: 'cs-autocomplete-fig1',
    question: 'Does raising the debounce from 150ms to 400ms eliminate the stale list?',
    primitive: 'LaneTimeline',
    control: 'binary-with-margin',
  },
  sources: [
    { title: 'AbortController — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController', note: 'What cancellation reaches, and what it does not.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
