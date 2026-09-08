import type { Claim } from '../../types'

const claims: Claim[] = [
  {
    id: 'incl-a11y-tree-c1',
    assertion: 'A screen reader reads the accessibility tree, not the DOM: an element that looks labelled on screen can arrive with no name at all.',
    evidence: 'derivation',
    flipCondition: 'When the visible text IS the accessible name — a plain button with text content — the two agree and the distinction never surfaces.',
    misconception: 'If I can see the label, a screen reader can read it.',
    conceptTokens: [['accessibility tree', 'a11y tree', 'tree'], ['not', 'rather than', 'instead of'], ['dom', 'markup', 'visual']],
    probes: ['incl-a11y-tree-i1', 'incl-a11y-tree-i5'],
  },
  {
    id: 'incl-a11y-tree-c2',
    assertion: 'aria-hidden on the only text inside a control leaves it with an empty accessible name, so an icon button announces as nothing at all.',
    evidence: 'measurement',
    flipCondition: 'Keeping visually hidden text in the tree — a clip-rect utility rather than aria-hidden — names the control while hiding it visually.',
    misconception: 'aria-hidden just hides it visually, like display: none.',
    conceptTokens: [['aria-hidden'], ['empty', 'no name', 'unnamed', 'nothing'], ['icon', 'button', 'control']],
    probes: ['incl-a11y-tree-i2', 'incl-a11y-tree-i6'],
  },
  {
    id: 'incl-a11y-tree-c3',
    assertion: 'A placeholder is the last resort in the accessible-name computation and it disappears as soon as the field has a value, so it is the only label that vanishes exactly when the user is mid-task.',
    evidence: 'measurement',
    flipCondition: 'A visible <label for> or an aria-label sits earlier in the algorithm and survives input.',
    misconception: 'A placeholder is a perfectly good label.',
    conceptTokens: [['placeholder'], ['last resort', 'lowest', 'fallback'], ['disappears', 'vanishes', 'gone', 'value']],
    probes: ['incl-a11y-tree-i3', 'incl-a11y-tree-i7'],
  },
  {
    id: 'incl-a11y-tree-c4',
    assertion: 'Naming, reachability and focus order are three independent properties: tab order follows the DOM rather than the visual layout, and a perfectly named control can still be unreachable or reached in a nonsensical sequence.',
    evidence: 'derivation',
    flipCondition: 'When DOM order matches visual order and every control is a native element, all three coincide for free.',
    misconception: 'If it has an aria-label it is accessible.',
    conceptTokens: [['independent', 'separate', 'three'], ['focus order', 'tab order'], ['dom order', 'source order'], ['visual', 'layout']],
    probes: ['incl-a11y-tree-i4', 'incl-a11y-tree-i8'],
  },
]
export default claims
