import type { Item } from '../../types'

/** Verb is `diagnose`, so the auto-graded judgment items here DO move Mastery. */
const items: Item[] = [
  {
    id: 'ui-stacking-context-i3', kind: 'predict', primaryClaim: 'ui-stacking-context-c3', secondaryClaim: 'ui-stacking-context-c1',
    prompt: 'A sticky header has z-index: 10. Deep inside the page a card has transform: translateZ(0), added months ago "for GPU acceleration". A modal rendered inside that card is position: fixed; z-index: 9999. Does the modal paint above the header?',
    payload: {
      control: 'binary-with-margin', options: ['yes — 9999 beats 10', 'no — it never gets compared to the header'],
      correct: 'no — it never gets compared to the header',
      whyPlausible: {
        'yes — 9999 beats 10': 'That is true when both elements are in the same stacking context. The transform put them in different ones, so the numbers are never compared at all — the card is, and it has no z-index.',
      },
    },
  },
  { id: 'ui-stacking-context-i1', kind: 'mcq-rationale', primaryClaim: 'ui-stacking-context-c1',
    prompt: 'Raising the modal from 9999 to 999999 changes nothing. Why?',
    payload: {
      options: ['The browser caps z-index', 'It is compared only inside its own stacking context', 'position: fixed ignores z-index', 'The header uses !important'],
      correct: 1,
      rationales: ['Because there is a maximum value', 'Because the comparison never reaches the header — the card is what competes with it', 'Because fixed elements are special', 'Because specificity wins'],
      correctRationale: 1,
    } },
  { id: 'ui-stacking-context-i5', kind: 'claim-recall', primaryClaim: 'ui-stacking-context-c1',
    prompt: 'What is a z-index actually compared against?' },
  { id: 'ui-stacking-context-i2', kind: 'spot-the-failure', primaryClaim: 'ui-stacking-context-c2',
    prompt: 'Which property on the card created the stacking context?',
    payload: {
      regions: ['transform: translateZ(0)', 'position: fixed on the modal', 'z-index: 10 on the header'],
      classes: ['a property that creates a context with no z-index', 'a z-index on a positioned element', 'a specificity conflict'],
      hitRegion: 'transform: translateZ(0)', failureClass: 'a property that creates a context with no z-index',
      adjacentHint: 'That one does create a context — but on the header, which is not the element trapping the modal.',
    } },
  { id: 'ui-stacking-context-i6', kind: 'cloze', primaryClaim: 'ui-stacking-context-c2',
    prompt: 'transform, filter, will-change and an ______ below 1 each create a stacking ______ without any z-index at all.',
    payload: { blanks: ['opacity', 'context'], accept: { 0: ['opacity'], 1: ['context'] } } },
  { id: 'ui-stacking-context-i7', kind: 'constraint-flip', primaryClaim: 'ui-stacking-context-c3',
    prompt: 'You delete the transform from the card. Does the modal now paint above the header?',
    payload: { direction: 'yes', bands: ['yes, immediately', 'no, still trapped'], correctBand: 0,
      flipParameter: 'whether any ancestor creates a stacking context' } },
  { id: 'ui-stacking-context-i4', kind: 'mcq-rationale', primaryClaim: 'ui-stacking-context-c4',
    prompt: 'The modal is position: fixed; inset: 0, and its backdrop covers only the card. Why?',
    payload: {
      options: ['inset: 0 is relative to the parent', 'The transformed ancestor became its containing block', 'fixed does not support inset', 'The card has overflow: hidden'],
      correct: 1,
      rationales: ['Because inset always resolves against the parent', 'Because a transformed ancestor captures position: fixed — the same property that trapped the paint order', 'Because inset needs absolute', 'Because clipping'],
      correctRationale: 1,
    } },
  { id: 'ui-stacking-context-i8', kind: 'cloze', primaryClaim: 'ui-stacking-context-c4',
    prompt: 'A transformed ancestor becomes the ______ ______ for position: fixed, so the backdrop covers the card rather than the ______.',
    payload: { blanks: ['containing', 'block', 'viewport'], accept: { 0: ['containing'], 1: ['block'], 2: ['viewport', 'screen'] } } },
  { id: 'ui-stacking-context-i9', kind: 'constraint-flip', primaryClaim: 'ui-stacking-context-c5',
    prompt: 'You move the modal to a native <dialog> opened with showModal(). Does any ancestor still trap it?',
    payload: { direction: 'no', bands: ['no — the top layer is outside the tree', 'yes — it is still a descendant'], correctBand: 0,
      flipParameter: 'whether the element is in the top layer or the stacking tree' } },
]
export default items
