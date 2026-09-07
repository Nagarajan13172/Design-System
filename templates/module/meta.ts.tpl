import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: '__ID__',
  // `deep` additionally requires reviewedBy/reviewedAt — a second reader is a hard gate.
  status: 'drafted',
  figure: {
    id: '__ID__-fig1',
    question: '__QUESTION__',
    primitive: '__PRIMITIVE__',
    // binary-with-margin | rank | point — pick the one whose wrong answers are informative.
    control: 'binary-with-margin',
  },
  sources: [],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
