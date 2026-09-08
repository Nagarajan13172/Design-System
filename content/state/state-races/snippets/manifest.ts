import type { SnippetSpec } from '../../../../scripts/build-code'

/**
 * Blanks are authored as TOKEN TEXT plus an occurrence. `pnpm build:code` resolves
 * them to positions and FAILS if a token is ambiguous — see vite/shiki-plugin.ts.
 */
const snippets: SnippetSpec[] = [
  { id: 'naive', file: 'src/naive.ts', label: 'the version that races', diffAgainst: 'src/sequenced.ts' },
  {
    id: 'sequenced', file: 'src/sequenced.ts', label: 'with a sequence guard',
    blanks: [
      { id: 'b1', token: 'latest', occurrence: 2 },
      { id: 'b2', token: 'return', occurrence: 1 },
      { id: 'b3', token: 'seq', occurrence: 1 },
      { id: 'b4', token: 'seq', occurrence: 2 },
    ],
  },
]
export default snippets
