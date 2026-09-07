// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Playground } from './Playground'
import { run, DEFAULTS } from '@content/state/state-races/sim'
import meta from '@content/state/state-races/meta'

/**
 * THE GATE IS A DATA DEPENDENCY, NOT A CSS OVERLAY.
 *
 * This is the single most important behavioural test in the product. If the gate
 * degrades into an overlay, the app still looks correct in every screenshot while
 * having silently lost the mechanism that makes it a learning product rather than
 * a docs site — and this audience would find the bypass within a week.
 */
describe('Playground prediction gate', () => {
  const setup = 'A typeahead with a 300ms debounce.'
  // No vitest `globals`, so RTL's auto-cleanup is not registered; renders would
  // otherwise accumulate in one document and every query would find duplicates.
  afterEach(cleanup)

  it('does not call sim.run() before a prediction is committed', () => {
    const spy = vi.fn(run)
    render(<Playground meta={meta} setup={setup} run={spy} />)
    expect(spy).not.toHaveBeenCalled()
  })

  it('renders the scaffold but NO data before the gate opens', () => {
    const { container } = render(<Playground meta={meta} setup={setup} run={run} />)
    // The lanes exist — the learner can see what they are predicting about...
    expect(container.querySelector('svg')).toBeTruthy()
    // ...but no data span exists in the DOM at all, because there is no timeline.
    expect(container.querySelectorAll('[data-span]').length).toBe(0)
    expect(screen.getByText(/commit a prediction/i)).toBeTruthy()
  })

  it('the figure question is stated exactly once', () => {
    render(<Playground meta={meta} setup={setup} run={run} />)
    expect(screen.getAllByText(meta.figure.question)).toHaveLength(1)
  })

  it('reveals data only after a commit, and reports the prediction back', async () => {
    const user = userEvent.setup()
    const spy = vi.fn(run)
    const { container } = render(<Playground meta={meta} setup={setup} run={spy} />)

    await user.type(screen.getByLabelText(/your prediction/i), '4')
    await user.click(screen.getByRole('button', { name: /lock it in/i }))

    expect(spy).toHaveBeenCalledTimes(1)
    expect(container.querySelectorAll('[data-span]').length).toBeGreaterThan(0)
    // Their own answer is plotted against the measured one, not just graded.
    expect(screen.getByText(/you predicted/i)).toBeTruthy()
    expect(screen.getByText(/4 · \d+% sure/)).toBeTruthy()
  })

  it('a committed prediction cannot be revised', async () => {
    const user = userEvent.setup()
    render(<Playground meta={meta} setup={setup} run={run} />)
    await user.type(screen.getByLabelText(/your prediction/i), '4')
    await user.click(screen.getByRole('button', { name: /lock it in/i }))
    // The control is gone from the DOM entirely — there is nothing to edit.
    expect(screen.queryByLabelText(/your prediction/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /lock it in/i })).toBeNull()
  })

  it('offers no skip affordance in any form', () => {
    render(<Playground meta={meta} setup={setup} run={run} />)
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.textContent?.toLowerCase()).not.toMatch(/skip|reveal|show me|later/)
    }
  })

  it('the measured readout matches what the sim reports', async () => {
    const user = userEvent.setup()
    render(<Playground meta={meta} setup={setup} run={run} />)
    await user.type(screen.getByLabelText(/your prediction/i), '4')
    await user.click(screen.getByRole('button', { name: /lock it in/i }))
    const expected = String(run(DEFAULTS).readout!.staleRatePct)
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
  })
})
