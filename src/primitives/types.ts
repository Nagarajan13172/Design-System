import type { Annotation, Frame } from '@content/types'

/**
 * Every primitive takes the SAME shape. `state: null` is the gated case: the
 * primitive renders its scaffold — axes, lanes, ghost outline, parameter chips —
 * and NO data. That is not a visual trick: the caller has not run the sim, so
 * there is nothing to draw and nothing in the DOM to inspect.
 */
export interface PrimitiveProps<S> {
  state: S | null
  annotations: Annotation[]
  /** The ghost baseline. Rendered underneath at low contrast, toggleable. */
  ghost?: S | null
  showGhost?: boolean
  /** Reduced motion: composite every annotation at once, numbered. */
  composite?: boolean
  labelledBy?: string
}

export type FrameOf<S> = Frame<S>
