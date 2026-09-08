// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Plot2D } from './Plot2D'
import type { Plot2DState } from '@content/types'

afterEach(cleanup)

const flat: Plot2DState = {
  xAxis: { label: 'days', min: 0, max: 3 },
  yAxis: { label: 'cards' },
  // Every value zero: this is the empty-forecast case, and it made every axis tick
  // compute to the same number.
  series: [{ id: 'due', label: 'due', kind: 'bar', points: [0, 1, 2, 3].map(x => ({ x, y: 0 })) }],
}

describe('Plot2D', () => {
  it('renders a flat series without duplicate React keys', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Plot2D state={flat} annotations={[]} />)
    const dupes = spy.mock.calls.filter(c => String(c[0]).includes('same key'))
    expect(dupes, 'duplicate key warning').toEqual([])
    spy.mockRestore()
  })

  it('renders axes but NO series when gated', () => {
    const { container } = render(<Plot2D state={null} ghost={flat} annotations={[]} />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelectorAll('[data-series]').length).toBe(0)
  })

  it('renders the series once the gate opens', () => {
    const { container } = render(<Plot2D state={flat} annotations={[]} />)
    expect(container.querySelectorAll('[data-series]').length).toBe(1)
  })

  it('always carries an accessible name', () => {
    const { container } = render(<Plot2D state={flat} annotations={[]} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label') || svg.getAttribute('aria-labelledby')).toBeTruthy()
  })
})
