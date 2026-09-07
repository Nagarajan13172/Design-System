import type { LaneTimelineState, Primitive, StateMatrixState } from '@content/types'
import type { PrimitiveProps } from './types'
import { LaneTimeline } from './LaneTimeline'
import { StateMatrix } from './StateMatrix'

/**
 * Dispatches a figure to its primitive.
 *
 * The module loader erases the state type (a module's sim is loaded dynamically),
 * so the cast happens HERE, once per primitive, rather than leaking `any` through
 * the kit. `lint:content` guarantees a module's declared primitive matches the
 * state its sim actually produces.
 *
 * M1 ships LaneTimeline and StateMatrix — 113 of the 169 modules. The remaining
 * four arrive in M4, and each must have >= 2 real clients before it is declared
 * validated.
 */
const PENDING: Record<string, string> = {
  NodeGraph: 'M4', Plot2D: 'M4', LiveSurface: 'M4', CodeStage: 'M4',
}

export function Figure({ primitive, ...props }: { primitive: Primitive } & PrimitiveProps<unknown>) {
  switch (primitive) {
    case 'LaneTimeline':
      return <LaneTimeline {...(props as PrimitiveProps<LaneTimelineState>)} />
    case 'StateMatrix':
      return <StateMatrix {...(props as PrimitiveProps<StateMatrixState>)} />
    default:
      return (
        <div className="rounded border border-dashed p-6 text-center"
             style={{ borderColor: 'var(--border-strong)', color: 'var(--text-faint)' }}>
          <div className="font-mono">{primitive}</div>
          <div className="mt-1">not built yet — scheduled for {PENDING[primitive] ?? 'a later milestone'}</div>
        </div>
      )
  }
}
