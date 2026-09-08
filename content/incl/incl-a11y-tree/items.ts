import type { Item } from '../../types'

/**
 * The module's verb is `explain`, so these items schedule and count for Coverage
 * but do not move Mastery — only judgment verbs do. `predict` is the figure's gate.
 */
const items: Item[] = [
  {
    id: 'incl-a11y-tree-i2', kind: 'predict', primaryClaim: 'incl-a11y-tree-c2',
    prompt: 'An icon button contains only <span aria-hidden="true">Submit</span>. What does a screen reader announce?',
    payload: {
      control: 'binary-with-margin',
      options: ['"Submit, button"', '"button" — with no name'],
      correct: '"button" — with no name',
      whyPlausible: {
        '"Submit, button"': 'The text is there in the DOM, which is what makes this so easy to miss — but aria-hidden removes it from the tree, and it was the only text the control had.',
      },
    },
  },
  { id: 'incl-a11y-tree-i1', kind: 'cloze', primaryClaim: 'incl-a11y-tree-c1',
    prompt: 'A screen reader reads the ______ ______, not the DOM.',
    payload: { blanks: ['accessibility', 'tree'], accept: { 0: ['accessibility', 'a11y'], 1: ['tree'] } } },
  { id: 'incl-a11y-tree-i5', kind: 'claim-recall', primaryClaim: 'incl-a11y-tree-c1',
    prompt: 'Why can an element that looks labelled arrive unnamed?' },
  { id: 'incl-a11y-tree-i6', kind: 'claim-recall', primaryClaim: 'incl-a11y-tree-c2',
    prompt: 'What is the difference between aria-hidden and a visually-hidden utility class?' },
  { id: 'incl-a11y-tree-i3', kind: 'order-steps', primaryClaim: 'incl-a11y-tree-c3',
    prompt: 'Order the accessible-name computation from highest precedence to lowest.',
    payload: {
      steps: ['aria-labelledby', 'aria-label', 'a native <label for>', 'the element’s own text content', 'placeholder or title'],
      hardOrder: [[0, 1], [2, 4], [1, 4]],
    } },
  { id: 'incl-a11y-tree-i7', kind: 'cloze', primaryClaim: 'incl-a11y-tree-c3',
    prompt: 'A ______ is the last resort in the name computation, and it disappears once the field has a ______.',
    payload: { blanks: ['placeholder', 'value'], accept: { 0: ['placeholder'], 1: ['value', 'content'] } } },
  { id: 'incl-a11y-tree-i4', kind: 'claim-recall', primaryClaim: 'incl-a11y-tree-c4',
    prompt: 'Name the three properties that fail independently here.' },
  { id: 'incl-a11y-tree-i8', kind: 'cloze', primaryClaim: 'incl-a11y-tree-c4',
    prompt: 'Tab order follows ______ order, not ______ order.',
    payload: { blanks: ['DOM', 'visual'], accept: { 0: ['dom', 'source'], 1: ['visual', 'layout', 'css'] } } },
]
export default items
