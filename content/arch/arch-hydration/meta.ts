import type { ModuleMeta } from '../../types'

const meta: ModuleMeta = {
  id: 'arch-hydration',
  status: 'drafted',
  figure: {
    id: 'arch-hydration-fig1',
    question: 'Which column does SSR make worse, and which strategy is the only one that closes it?',
    primitive: 'StateMatrix',
    control: 'binary-with-margin',
  },
  sources: [
    { title: 'Rendering on the Web — web.dev', url: 'https://web.dev/articles/rendering-on-the-web', note: 'The strategy taxonomy and what each one trades.' },
    { title: 'React Server Components', url: 'https://react.dev/reference/rsc/server-components', note: 'Why the boundary is a graph cut over the import tree, not a rendering mode.' },
  ],
  reviewedBy: null,
  reviewedAt: null,
}
export default meta
