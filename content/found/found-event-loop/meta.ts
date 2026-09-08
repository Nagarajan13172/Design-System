import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'found-event-loop',
  status: 'drafted',
  figure: {
    id: 'found-event-loop-fig1',
    question: 'In what order do D, A, B and C run, and how many paints occur?',
    primitive: 'LaneTimeline',
    // A rank control: the interesting failure is ordering A against C, and a
    // binary question would let a guess look like understanding.
    control: 'rank',
  },
  sources: [
    { title: 'HTML Standard — event loop processing model', url: 'https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model', note: 'Normative order of tasks, the microtask checkpoint, and the rendering steps.' },
    { title: 'HTML Standard — update the rendering', url: 'https://html.spec.whatwg.org/multipage/webappapis.html#update-the-rendering', note: 'Where rAF callbacks run relative to layout and paint.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
