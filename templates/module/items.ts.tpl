import type { Item } from '../../types'

/**
 * The module's verb is `__VERB__`, which constrains what may assess it.
 * Only MASTERY_KINDS move Mastery; cloze / order-steps / claim-recall feed the
 * scheduler only.
 */
const items: Item[] = [
  {
    id: '__ID__-i1',
    kind: 'claim-recall',
    primaryClaim: '__ID__-c1',
    prompt: 'TODO',
  },
]
export default items
