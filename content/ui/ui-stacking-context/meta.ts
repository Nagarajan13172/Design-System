import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'ui-stacking-context',
  status: 'drafted',
  figure: {
    id: 'ui-stacking-context-fig1',
    question: 'Does the modal paint above the header, and what does its backdrop actually cover?',
    primitive: 'NodeGraph',
    control: 'binary-with-margin',
  },
  sources: [
    { title: 'Stacking context — MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context', note: 'The normative list of properties that create one.' },
    { title: 'CSS Position — containing block', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_display/Containing_block', note: 'Why a transformed ancestor captures position: fixed.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
