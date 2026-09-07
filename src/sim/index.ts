/**
 * THE SIM RUNTIME.
 *
 * A sim is pure: `run(params, { rng }) => Timeline`, returning the ENTIRE frame
 * sequence eagerly. No Date.now, no Math.random, no performance.now, no React —
 * all four are banned by ESLint inside sim files.
 *
 * Eager, deterministic frames buy four things at once:
 *   - scrubbing and stepping are free (index into an array)
 *   - reduced motion is trivial (composite every annotation, numbered)
 *   - the live-region narration is a by-product, not extra authoring
 *   - THE PEDAGOGICAL CLAIM IS UNIT-TESTABLE as an assertion over the timeline
 *
 * That last one is the point. Wrong teaching content is the worst bug this
 * product can ship, and it is invisible to every other kind of test.
 */
import type { Frame, Timeline, Annotation, Rng, ClaimId } from '../../content/types'

export type { Frame, Timeline, Annotation, Rng }

/**
 * mulberry32 — small, fast, and good enough for teaching sims.
 * Seeded so a figure renders identically on every visit and in every test.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal via Box-Muller, from a seeded uniform. */
export function normal(rng: Rng): number {
  const u = 1 - rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * Log-normal parameterised the way engineers actually talk about latency:
 * by its median and its p95, not by mu and sigma.
 */
export function lognormalFromMedianP95(median: number, p95: number) {
  const mu = Math.log(median)
  const sigma = Math.log(p95 / median) / 1.6448536269514722 // z(0.95)
  return (rng: Rng) => Math.exp(mu + sigma * normal(rng))
}

export function quantile(xs: readonly number[], q: number): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * q
  const lo = Math.floor(i), hi = Math.ceil(i)
  return lo === hi ? s[lo]! : s[lo]! + (s[hi]! - s[lo]!) * (i - lo)
}

/**
 * Builds a Timeline while enforcing the cognitive-load invariants at construction
 * time, so a violation fails the authoring loop rather than surfacing in lint later.
 */
export class TimelineBuilder<S> {
  private frames: Frame<S>[] = []
  private stages: Timeline<S>['stages'] = []

  stage(id: string, label: string): this {
    this.stages.push({ id, label, frame: this.frames.length })
    return this
  }

  frame(f: Omit<Frame<S>, 't'> & { t?: number }): this {
    const frame: Frame<S> = { ...f, t: f.t ?? this.frames.length } as Frame<S>
    if (frame.annotations.length > 7) {
      throw new Error(`SIM CONTRACT: frame ${this.frames.length} has ${frame.annotations.length} annotations (max 7). Split it into two stages.`)
    }
    if (frame.channels.length > 2) {
      throw new Error(`SIM CONTRACT: frame ${this.frames.length} animates ${frame.channels.length} channels (max 2): ${frame.channels.join(', ')}. Make one of them a stage, not a concurrent channel.`)
    }
    if (!frame.narration?.trim()) {
      throw new Error(`SIM CONTRACT: frame ${this.frames.length} has no narration. Every frame is read into a live region.`)
    }
    this.frames.push(frame)
    return this
  }

  build(ghost?: Timeline<S>['ghost'], readout?: Timeline<S>['readout']): Timeline<S> {
    if (!this.frames.length) throw new Error('SIM CONTRACT: timeline has no frames')
    return { frames: this.frames, stages: this.stages, ghost, readout }
  }
}

/** Convenience for the common "annotate a point on a lane" case. */
export const note = (
  id: string, laneId: string, t: number, text: string, tone: Annotation['tone'] = 'neutral',
): Annotation => ({ id, at: { laneId, t }, text, tone })

export type { ClaimId }
