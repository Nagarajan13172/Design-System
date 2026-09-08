import type { ReactNode } from 'react'
import type {
  LaneTimelineState, NodeGraphState, StateMatrixState, Plot2DState,
  CodeStageState, LiveSurfaceState, Primitive,
} from '@content/types'
import type { PrimitiveProps } from './types'
import { LaneTimeline } from './LaneTimeline'
import { StateMatrix } from './StateMatrix'
import { NodeGraph } from './NodeGraph'
import { Plot2D } from './Plot2D'
import { CodeStage } from './CodeStage'
import { LiveSurface } from './LiveSurface'

/**
 * Dispatches a figure to its primitive.
 *
 * The module loader erases the state type (a module's sim is loaded dynamically),
 * so the cast happens HERE, once per primitive, rather than leaking `any` through
 * the kit. `lint:content` guarantees a module's declared primitive matches the
 * state its sim actually produces.
 */
export interface FigureProps extends PrimitiveProps<unknown> {
  primitive: Primitive
  /** Required by LiveSurface only: the author's real-DOM render function. */
  renderSurface?: (props: Record<string, unknown>) => ReactNode
}

export function Figure({ primitive, renderSurface, ...props }: FigureProps) {
  switch (primitive) {
    case 'LaneTimeline':
      return <LaneTimeline {...(props as PrimitiveProps<LaneTimelineState>)} />
    case 'StateMatrix':
      return <StateMatrix {...(props as PrimitiveProps<StateMatrixState>)} />
    case 'NodeGraph':
      return <NodeGraph {...(props as PrimitiveProps<NodeGraphState>)} />
    case 'Plot2D':
      return <Plot2D {...(props as PrimitiveProps<Plot2DState>)} />
    case 'CodeStage':
      return <CodeStage {...(props as PrimitiveProps<CodeStageState>)} />
    case 'LiveSurface':
      if (!renderSurface) {
        // A LiveSurface module must export `renderSurface` from its viz. Failing
        // loudly beats rendering an empty box that looks like a styling bug.
        return <Missing primitive={primitive} reason="its module does not export `renderSurface`" />
      }
      return <LiveSurface {...(props as PrimitiveProps<LiveSurfaceState>)} render={renderSurface} />
  }
}

function Missing({ primitive, reason }: { primitive: string; reason: string }) {
  return (
    <div className="rounded border border-dashed p-6 text-center"
         style={{ borderColor: 'var(--d-error)', color: 'var(--d-error)' }}>
      <div className="font-mono">{primitive}</div>
      <div className="mt-1 text-[13px]">{reason}</div>
    </div>
  )
}

/**
 * A primitive is VALIDATED once at least two real modules use it. Until then it is
 * provisional: one client cannot tell you whether an abstraction generalises, and
 * declaring it validated early is how a kit calcifies around its first use case.
 */
export const VALIDATION_THRESHOLD = 2
