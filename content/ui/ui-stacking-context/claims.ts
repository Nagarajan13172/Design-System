import type { Claim } from '../../types'

const claims: Claim[] = [
  {
    id: 'ui-stacking-context-c1',
    assertion: 'A z-index is compared only against siblings within the same stacking context, so a value of 9999 says nothing about how an element paints relative to anything outside that context.',
    evidence: 'derivation',
    flipCondition: 'If every ancestor participated in the root context, the raw numbers would be directly comparable.',
    misconception: 'A bigger z-index always paints on top.',
    conceptTokens: [['sibling', 'within', 'inside', 'same'], ['stacking context', 'context'], ['compare', 'compared', 'relative']],
    probes: ['ui-stacking-context-i1', 'ui-stacking-context-i5'],
  },
  {
    id: 'ui-stacking-context-c2',
    assertion: 'transform, filter, will-change, isolation and an opacity below 1 all create a stacking context on their own, with no z-index and no positioning involved.',
    evidence: 'specification',
    flipCondition: 'A plain positioned element with no z-index does not create one, which is why `position: relative` alone is safe.',
    misconception: 'Only z-index creates a stacking context.',
    conceptTokens: [['transform', 'filter', 'opacity', 'will-change'], ['creates', 'establishes'], ['without', 'no z-index', 'on their own']],
    probes: ['ui-stacking-context-i2', 'ui-stacking-context-i6'],
  },
  {
    id: 'ui-stacking-context-c3',
    assertion: 'A translateZ(0) added for GPU acceleration traps every descendant: the modal inside it loses to a header with z-index 10, because the card holding it has no z-index at all.',
    evidence: 'measurement',
    flipCondition: 'Removing the transform, or giving the card a z-index above the header, restores the expected order.',
    misconception: 'translateZ(0) is a free performance hint with no layout consequences.',
    conceptTokens: [['transform', 'translatez', 'gpu'], ['trap', 'trapped', 'contained', 'loses'], ['descendant', 'child', 'modal'], ['header', '10']],
    probes: ['ui-stacking-context-i3', 'ui-stacking-context-i7'],
  },
  {
    id: 'ui-stacking-context-c4',
    assertion: 'A transformed ancestor also becomes the containing block for position: fixed, so the same one property both traps the paint order and shrinks the backdrop to the card instead of the viewport.',
    evidence: 'measurement',
    flipCondition: 'Without a transformed ancestor, fixed resolves against the viewport as expected.',
    misconception: 'position: fixed is always relative to the viewport.',
    conceptTokens: [['containing block'], ['fixed'], ['viewport'], ['same', 'also', 'both']],
    probes: ['ui-stacking-context-i4', 'ui-stacking-context-i8'],
  },
  {
    id: 'ui-stacking-context-c5',
    assertion: 'The top layer — a native dialog or a popover — sits outside the stacking tree entirely, so no ancestor can trap it and no z-index arms race is needed.',
    evidence: 'specification',
    flipCondition: 'A div-based modal is inside the tree by construction, which is the whole reason the arms race exists.',
    misconception: 'A high enough z-index is equivalent to the top layer.',
    conceptTokens: [['top layer', 'dialog', 'popover'], ['outside', 'escapes', 'not in'], ['no z-index', 'without', 'unnecessary']],
    probes: ['ui-stacking-context-i9'],
  },
]
export default claims
