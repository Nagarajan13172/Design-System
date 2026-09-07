import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'state-races',
  // Authored, not yet second-read. `deep` requires reviewedBy/reviewedAt and lint
  // enforces it: wrong teaching content is the worst bug this product can ship.
  status: 'drafted',
  figure: {
    id: 'state-races-fig1',
    question: 'With no guard at all, what is displayed one second after the last keystroke — and would a 300ms debounce have prevented it?',
    primitive: 'LaneTimeline',
    control: 'point',
  },
  sources: [
    { title: 'AbortController — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController', note: 'Cancellation semantics: what abort does and does not reach.' },
    { title: 'Fetch Standard — aborting a fetch', url: 'https://fetch.spec.whatwg.org/#dom-global-fetch', note: 'Normative behaviour for an aborted request already in flight.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
