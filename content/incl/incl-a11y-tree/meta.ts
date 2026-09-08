import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'incl-a11y-tree',
  status: 'drafted',
  figure: {
    id: 'incl-a11y-tree-fig1',
    question: 'What name does each control arrive with in the accessibility tree?',
    primitive: 'LiveSurface',
    control: 'binary-with-margin',
  },
  sources: [
    { title: 'Accessible Name and Description Computation', url: 'https://www.w3.org/TR/accname-1.2/', note: 'The normative resolution order, including placeholder as a last resort.' },
    { title: 'aria-hidden — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden', note: 'Why it removes from the tree rather than hiding visually.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
