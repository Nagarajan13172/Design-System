/**
 * incl-a11y-tree — what a screen reader actually receives.
 *
 * PURE, and the exception the LiveSurface contract exists for: this sim emits PROP
 * STATES and overlay specs rather than geometry, because the accessible name of an
 * element is computed from real DOM and its position is only known after layout.
 * `viz.tsx` holds the render function, since a sim may not import React.
 */
import { TimelineBuilder, note } from '../../../src/sim'
import type { Rng, Timeline, LiveSurfaceState } from '../../types'

export interface Params {
  /** The label people reach for first. */
  useAriaLabel: boolean
  /** A visible <label for>, which is what actually works. */
  useVisibleLabel: boolean
  /** A placeholder standing in for a label. */
  usePlaceholder: boolean
  /** Wrap the icon button's text in aria-hidden — a common own-goal. */
  hideIconText: boolean
}

export const DEFAULTS: Params = { useAriaLabel: false, useVisibleLabel: false, usePlaceholder: true, hideIconText: true }

/**
 * Accessible name computation, in the order the spec actually resolves it.
 * Simplified to the branches people hit, and asserted in sim.test.ts.
 */
export function accessibleName(p: Params): { name: string; from: string } {
  if (p.useAriaLabel) return { name: 'Search products', from: 'aria-label' }
  if (p.useVisibleLabel) return { name: 'Search products', from: '<label for>' }
  // Placeholder is the LAST resort in the algorithm, and it disappears on input.
  if (p.usePlaceholder) return { name: 'Search…', from: 'placeholder (last resort)' }
  return { name: '', from: 'nothing — the control is unnamed' }
}

export function iconButtonName(p: Params): { name: string; from: string } {
  return p.hideIconText
    ? { name: '', from: 'aria-hidden removed its only text' }
    : { name: 'Submit', from: 'contents' }
}

const state = (p: Params, overlays: LiveSurfaceState['overlays']): LiveSurfaceState => {
  const field = accessibleName(p)
  const button = iconButtonName(p)
  return {
    props: { ...p },
    overlays,
    counters: [
      { label: 'field name', value: field.name || '(none)' },
      { label: 'computed from', value: field.from },
      { label: 'button name', value: button.name || '(none)' },
    ],
  }
}

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<LiveSurfaceState> {
  const p = { ...DEFAULTS, ...params }
  const b = new TimelineBuilder<LiveSurfaceState>()

  b.stage('visual', 'What a sighted user sees')
  b.frame({
    narration: 'A search field and a submit button. Visually complete: the placeholder says what to type and the icon says what the button does.',
    channels: ['overlays'], explains: 'incl-a11y-tree-c1',
    annotations: [note('a1', 'x', 0, 'looks labelled')],
    state: state(p, [{ id: 'o1', kind: 'box', selector: 'input', tone: 'neutral' }]),
  })

  b.stage('names', 'What the accessibility tree received')
  b.frame({
    narration: `The field's accessible name comes from ${accessibleName(p).from}. The button's name is ${iconButtonName(p).name || 'empty — aria-hidden removed the only text it had'}.`,
    channels: ['overlays'], explains: 'incl-a11y-tree-c2',
    annotations: [
      note('a2', 'x', 0, `field: "${accessibleName(p).name || '(none)'}"`, accessibleName(p).from.includes('last resort') ? 'bad' : 'good'),
      note('a3', 'x', 0, `button: "${iconButtonName(p).name || '(none)'}"`, iconButtonName(p).name ? 'good' : 'bad'),
    ],
    state: state(p, [
      { id: 'o1', kind: 'label', selector: 'input', text: accessibleName(p).name || 'unnamed', tone: accessibleName(p).from.includes('last resort') ? 'bad' : 'good' },
      { id: 'o2', kind: 'label', selector: 'button', text: iconButtonName(p).name || 'unnamed', tone: iconButtonName(p).name ? 'good' : 'bad' },
    ]),
  })

  b.stage('typing', 'And then the user starts typing')
  b.frame({
    narration: 'A placeholder is the last resort in the name computation, and it vanishes the moment there is a value — so the only label disappears exactly when the user is mid-task.',
    channels: ['overlays'], explains: 'incl-a11y-tree-c3',
    annotations: [note('a4', 'x', 0, 'the label was the placeholder, and it is gone', 'bad')],
    state: state({ ...p }, [
      { id: 'o1', kind: 'box', selector: 'input', text: 'now unnamed', tone: 'bad' },
    ]),
  })

  b.stage('order', 'Focus order is a third, separate thing')
  b.frame({
    narration: 'Tab order follows the DOM, not the visual layout, and it is unrelated to whether anything is named. Names and order fail independently.',
    channels: ['overlays'], explains: 'incl-a11y-tree-c4',
    annotations: [note('a5', 'x', 0, 'named ≠ reachable ≠ in a sensible order')],
    state: state(p, [
      { id: 'f1', kind: 'order', selector: 'input', order: 1, tone: 'neutral' },
      { id: 'f2', kind: 'order', selector: 'button', order: 2, tone: 'neutral' },
    ]),
  })

  const fixed = { ...p, useVisibleLabel: true, usePlaceholder: false, hideIconText: false }
  const ghost = {
    label: 'with a visible label',
    frames: [{
      t: 0,
      narration: `With a visible <label for>, the name comes from ${accessibleName(fixed).from} and survives typing.`,
      channels: [], explains: 'incl-a11y-tree-c3',
      annotations: [note('g1', 'x', 0, 'name survives input', 'good')],
      state: state(fixed, [{ id: 'o1', kind: 'label', selector: 'input', text: accessibleName(fixed).name, tone: 'good' }]),
    }],
  }

  return b.build(ghost, {
    fieldName: accessibleName(p).name || '(none)',
    computedFrom: accessibleName(p).from,
    buttonName: iconButtonName(p).name || '(none)',
  })
}
