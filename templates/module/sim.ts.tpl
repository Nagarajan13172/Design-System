/**
 * __ID__ — PURE. Injected clock, seeded rng, no React.
 * Returns the entire deterministic frame sequence eagerly.
 */
import { TimelineBuilder, note } from '../../../src/sim'
import type { Rng, Timeline, LaneTimelineState } from '../../types'

export interface Params { seed: number }
export const DEFAULTS: Params = { seed: 1 }

export function run(params: Partial<Params> = {}, _ctx?: { rng?: Rng }): Timeline<LaneTimelineState> {
  const p = { ...DEFAULTS, ...params }
  void p
  const lanes: LaneTimelineState['lanes'] = [{ id: 'a', label: 'TODO', role: 'actor' }]
  const b = new TimelineBuilder<LaneTimelineState>()
  b.stage('s1', 'TODO')
  b.frame({
    narration: 'TODO: what a screen reader hears at this instant.',
    channels: [], explains: '__ID__-c1',
    annotations: [note('n1', 'a', 0, 'TODO')],
    state: { lanes, spans: [] },
  })
  return b.build({ label: 'baseline', frames: [] })
}
